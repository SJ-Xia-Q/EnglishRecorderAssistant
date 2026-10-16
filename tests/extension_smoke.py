import os
from pathlib import Path
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(ROOT / ".playwright-browsers"))

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


EXTENSION = ROOT / "extension"
FIXTURE = ROOT / "tests" / "fixtures" / "platform.html"
TARGET_URL = "https://bytedance.aiforce.cloud/app/test-recording-task"


def main() -> None:
    fixture = (
        FIXTURE.read_text(encoding="utf-8")
        .replace("——6s", "——0.12s")
        .replace("——9s", "——0.12s")
        .replace("——7s", "——0.12s")
    )
    errors: list[str] = []

    with TemporaryDirectory(prefix="era-extension-") as profile, sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            profile,
            channel="chromium",
            headless=True,
            viewport={"width": 1280, "height": 720},
            args=[
                f"--disable-extensions-except={EXTENSION}",
                f"--load-extension={EXTENSION}",
            ],
        )
        context.route(
            "https://bytedance.aiforce.cloud/**",
            lambda route: route.fulfill(status=200, content_type="text/html", body=fixture),
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
        page.on(
            "console",
            lambda message: errors.append(f"console.{message.type}: {message.text}")
            if message.type == "error" else None,
        )
        page.goto(TARGET_URL)
        page.wait_for_load_state("networkidle")

        host = page.locator("#english-recording-assistant-root")
        try:
            host.wait_for(state="attached", timeout=5_000)
        except PlaywrightTimeoutError:
            extensions_page = context.new_page()
            extensions_page.goto("chrome://extensions/")
            loaded_extensions = extensions_page.evaluate(
                """() => {
                    const manager = document.querySelector('extensions-manager')?.shadowRoot;
                    const list = manager?.querySelector('extensions-item-list')?.shadowRoot;
                    return [...(list?.querySelectorAll('extensions-item') ?? [])].map((item) => ({
                        id: item.id,
                        name: item.shadowRoot?.querySelector('#name')?.textContent?.trim() ?? '',
                    }));
                }"""
            )
            print({
                "user_agent": page.evaluate("navigator.userAgent"),
                "target_url": page.url,
                "loaded_extensions": loaded_extensions,
            })
            extensions_page.close()
            raise
        assert host.get_attribute("data-era-state") == "reading"
        assert host.get_attribute("data-era-turn") == "1"

        panel = host.locator("[data-testid='panel']")
        assert panel.is_visible()
        assert "读完本轮后" in panel.inner_text()
        assert "Space" in panel.inner_text()

        intro = host.locator("[data-testid='intro']")
        assert intro.is_visible()
        intro.get_by_role("button", name="知道了").click()
        assert not intro.is_visible()

        host.get_by_role("button", name="开始静音").click()
        assert host.get_attribute("data-era-state") == "pause"
        page.wait_for_function(
            "document.querySelector('#english-recording-assistant-root')?.dataset.eraTurn === '2'"
        )

        page.keyboard.press("Space")
        assert host.get_attribute("data-era-state") == "pause"
        page.wait_for_function(
            "document.querySelector('#english-recording-assistant-root')?.dataset.eraTurn === '3'"
        )

        red_button = host.get_by_role("button", name="开始 5 秒")
        assert red_button.is_visible()
        assert "I am agree" in panel.inner_text()
        red_button.click()
        assert host.get_attribute("data-era-state") == "post-red"
        page.keyboard.press("Space")
        assert host.get_attribute("data-era-state") == "post-red"
        assert "继续朗读" in panel.inner_text()

        page.evaluate("window.mountRecorder()")
        recorder = page.locator("#real-recorder")
        recorder.wait_for(state="visible")
        page.wait_for_function(
            "document.querySelector('#real-recorder')?.dataset.eraRecorderDocked === 'true'"
        )
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        recorder_box = recorder.bounding_box()
        host_box = host.bounding_box()
        assert recorder_box is not None and recorder_box["y"] >= 0
        assert recorder_box["y"] + recorder_box["height"] <= 720
        assert host_box is not None and host_box["y"] >= 0
        assert host_box["y"] + host_box["height"] <= 720

        page.wait_for_function(
            "document.querySelector('#english-recording-assistant-root')?.dataset.eraState === 'complete'",
            timeout=7_000,
        )
        assert "本题节奏完成" in panel.inner_text()
        assert errors == []

        context.close()

    print("Extension smoke: overlay, controls, timer lock, and fixed positioning passed")


if __name__ == "__main__":
    main()

