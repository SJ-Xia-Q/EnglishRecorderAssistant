import os
from pathlib import Path
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(ROOT / ".playwright-browsers"))

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError, sync_playwright


EXTENSION = ROOT / "extension"
FIXTURE = ROOT / "tests" / "fixtures" / "platform.html"
ARTIFACTS = ROOT / "artifacts"
TARGET_URL = "https://bytedance.feishuapp.com/app/test-recording-task"


def show_overlay_from_extension(context, page) -> None:
    workers = context.service_workers
    worker = workers[0] if workers else context.wait_for_event("serviceworker")
    shown = worker.evaluate(
        """async (targetUrl) => {
            const tabs = await chrome.tabs.query({});
            const tab = tabs.find((candidate) => candidate.url === targetUrl)
                ?? tabs.find((candidate) => candidate.active);
            if (!tab?.id || !globalThis.RecordingAssistantBackground) {
                return false;
            }
            return globalThis.RecordingAssistantBackground.showOverlayInTab(tab.id);
        }""",
        page.url,
    )
    assert shown is True


def main() -> None:
    ARTIFACTS.mkdir(exist_ok=True)
    fixture = (
        FIXTURE.read_text(encoding="utf-8")
        .replace("——6s", "——0.12s")
        .replace("——9s", "——0.12s")
        .replace("——7s", "——0.12s")
        .replace(
            "</head>",
            """
            <style>
              /* Simulate an aggressive host page trying to reposition injected divs. */
              #english-recording-assistant-root {
                display: none !important;
                position: absolute !important;
                top: -2000px !important;
                right: auto !important;
                left: 4000px !important;
                width: 1px !important;
                transform: none !important;
                z-index: -1 !important;
              }
            </style>
            </head>
            """,
        )
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
            "https://bytedance.feishuapp.com/**",
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
        host_box = host.bounding_box()
        assert host_box is not None
        assert 0 <= host_box["x"] <= 1280 - host_box["width"]
        assert 0 <= host_box["y"] <= 720 - host_box["height"]

        page.set_viewport_size({"width": 720, "height": 720})
        page.wait_for_timeout(50)
        narrow_box = host.bounding_box()
        assert narrow_box is not None
        assert 0 <= narrow_box["x"] <= 720 - narrow_box["width"]
        assert 0 <= narrow_box["y"] <= 720 - narrow_box["height"]

        page.set_viewport_size({"width": 1280, "height": 720})
        page.wait_for_timeout(50)
        restored_box = host.bounding_box()
        assert restored_box is not None
        assert 0 <= restored_box["x"] <= 1280 - restored_box["width"]
        assert 0 <= restored_box["y"] <= 720 - restored_box["height"]

        drag_handle = host.locator("[data-drag-handle]")
        assert drag_handle.count() == 1
        drag_box = drag_handle.bounding_box()
        before_drag = host.bounding_box()
        assert drag_box is not None and before_drag is not None
        page.mouse.move(drag_box["x"] + 90, drag_box["y"] + 24)
        page.mouse.down()
        page.mouse.move(drag_box["x"] - 130, drag_box["y"] + 94, steps=8)
        page.mouse.up()
        page.wait_for_function(
            "document.querySelector('#english-recording-assistant-root')?.dataset.eraPositioned === 'true'"
        )
        after_drag = host.bounding_box()
        assert after_drag is not None
        assert after_drag["x"] < before_drag["x"] - 150
        assert after_drag["y"] > before_drag["y"] + 40

        page.set_viewport_size({"width": 360, "height": 420})
        page.wait_for_timeout(50)
        clamped_box = host.bounding_box()
        assert clamped_box is not None
        assert 0 <= clamped_box["x"] <= 360 - clamped_box["width"]
        assert 0 <= clamped_box["y"] <= 420 - clamped_box["height"]
        page.set_viewport_size({"width": 1280, "height": 720})
        page.wait_for_timeout(50)
        restored_drag = host.bounding_box()
        assert restored_drag is not None
        assert abs(restored_drag["x"] - after_drag["x"]) <= 1
        assert abs(restored_drag["y"] - after_drag["y"]) <= 1
        assert "读完本轮后" in panel.inner_text()
        assert "Space" in panel.inner_text()
        assert host.locator("[data-testid='timer']").is_hidden()
        assert host.get_attribute("aria-live") is None
        announcement = host.locator("[data-testid='announcement']")
        assert announcement.get_attribute("aria-live") == "polite"
        assert "读完本轮" in announcement.inner_text()

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
        reset_button = host.locator("[data-action='reset']")
        rescan_button = host.locator("[data-action='rescan']")
        assert reset_button.is_disabled()
        assert rescan_button.is_disabled()
        reset_button.evaluate("element => element.click()")
        rescan_button.evaluate("element => element.click()")
        assert host.get_attribute("data-era-state") == "post-red"
        page.keyboard.press("Space")
        assert host.get_attribute("data-era-state") == "post-red"
        assert "继续朗读" in panel.inner_text()

        countdown_before_close = float(host.locator("[data-testid='countdown']").inner_text())
        host.get_by_role("button", name="关闭助手").click()
        assert host.is_hidden()
        page.wait_for_timeout(350)
        show_overlay_from_extension(context, page)
        host.wait_for(state="visible")
        assert host.get_attribute("data-era-state") == "post-red"
        countdown_after_restore = float(host.locator("[data-testid='countdown']").inner_text())
        assert countdown_after_restore < countdown_before_close - 0.2

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
        page.screenshot(path=str(ARTIFACTS / "recording-assistant-red-timer.png"))

        page.wait_for_function(
            "document.querySelector('#english-recording-assistant-root')?.dataset.eraState === 'complete'",
            timeout=7_000,
        )
        assert "本题节奏完成" in panel.inner_text()
        assert host.locator("[data-testid='timer']").is_hidden()
        assert not reset_button.is_disabled()
        reset_button.click()
        assert host.get_attribute("data-era-state") == "reading"
        assert host.get_attribute("data-era-turn") == "1"

        host.locator("[data-action='compact']").click()
        assert host.get_attribute("data-era-compact") == "true"
        assert host.locator("[data-action='side']").count() == 0

        preferences_page = context.new_page()
        preferences_page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
        preferences_page.on(
            "console",
            lambda message: errors.append(f"console.{message.type}: {message.text}")
            if message.type == "error" else None,
        )
        preferences_page.goto(f"{TARGET_URL}-preferences")
        preferences_host = preferences_page.locator("#english-recording-assistant-root")
        preferences_host.wait_for(state="attached", timeout=5_000)
        preferences_page.wait_for_function(
            """() => {
                const host = document.querySelector('#english-recording-assistant-root');
                return host?.dataset.eraPositioned === 'true'
                    && host?.dataset.eraCompact === 'true';
            }"""
        )
        assert preferences_host.locator("[data-testid='intro']").is_hidden()
        preferences_box = preferences_host.bounding_box()
        assert preferences_box is not None
        assert abs(preferences_box["x"] - after_drag["x"]) <= 1
        assert abs(preferences_box["y"] - after_drag["y"]) <= 1
        preferences_page.close()
        assert errors == []

        context.close()

    print("Extension smoke: overlay, close/restore, drag, timer lock, and recorder docking passed")


if __name__ == "__main__":
    main()

