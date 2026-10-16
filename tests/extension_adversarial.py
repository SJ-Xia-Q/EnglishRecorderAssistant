import os
import time
from pathlib import Path
from tempfile import TemporaryDirectory


ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(ROOT / ".playwright-browsers"))

from playwright.sync_api import Page, sync_playwright


EXTENSION = ROOT / "extension"
FIXTURE = ROOT / "tests" / "fixtures" / "platform.html"
ARTIFACTS = ROOT / "artifacts"
TARGET_ROOT = "https://bytedance.feishuapp.com/app/adversarial"


def open_case(context, name: str) -> tuple[Page, list[str]]:
    errors: list[str] = []
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(f"pageerror: {error}"))
    page.on(
        "console",
        lambda message: errors.append(f"console.{message.type}: {message.text}")
        if message.type == "error" else None,
    )
    page.goto(f"{TARGET_ROOT}-{name}")
    page.wait_for_load_state("networkidle")
    page.locator("#english-recording-assistant-root").wait_for(
        state="attached",
        timeout=5_000,
    )
    return page, errors


def host_for(page: Page):
    return page.locator("#english-recording-assistant-root")


def advance_to_red_turn(page: Page) -> None:
    host = host_for(page)
    host.get_by_role("button", name="开始静音").click()
    page.wait_for_function(
        "document.querySelector('#english-recording-assistant-root')?.dataset.eraTurn === '2'"
    )
    page.keyboard.press("Space")
    page.wait_for_function(
        "document.querySelector('#english-recording-assistant-root')?.dataset.eraTurn === '3'"
    )
    assert host.get_attribute("data-era-state") == "reading"


def assert_inside_viewport(page: Page, selector: str) -> dict[str, float]:
    box = page.locator(selector).bounding_box()
    viewport = page.evaluate("() => ({ width: innerWidth, height: innerHeight })")
    assert box is not None
    assert box["x"] >= -0.5, (selector, box, viewport)
    assert box["y"] >= -0.5, (selector, box, viewport)
    assert box["x"] + box["width"] <= viewport["width"] + 0.5, (selector, box, viewport)
    assert box["y"] + box["height"] <= viewport["height"] + 0.5, (selector, box, viewport)
    return box


def boxes_overlap(left: dict[str, float], right: dict[str, float]) -> bool:
    return not (
        left["x"] + left["width"] <= right["x"]
        or right["x"] + right["width"] <= left["x"]
        or left["y"] + left["height"] <= right["y"]
        or right["y"] + right["height"] <= left["y"]
    )


def test_keyboard_guards(context) -> None:
    page, errors = open_case(context, "keyboard")
    host = host_for(page)

    page.wait_for_timeout(250)
    idle_mutations = page.evaluate(
        """() => new Promise((resolve) => {
            const root = document.querySelector('#english-recording-assistant-root').shadowRoot;
            let count = 0;
            const observer = new MutationObserver((records) => { count += records.length; });
            observer.observe(root, {
                subtree: true, childList: true, characterData: true, attributes: true,
            });
            setTimeout(() => {
                observer.disconnect();
                resolve(count);
            }, 300);
        })"""
    )
    assert idle_mutations <= 1, f"idle overlay produced {idle_mutations} DOM mutations"

    page.evaluate(
        """() => {
            const input = document.createElement('input');
            input.id = 'typing-input';
            const editor = document.createElement('div');
            editor.id = 'typing-editor';
            editor.contentEditable = 'true';
            editor.tabIndex = 0;
            document.body.prepend(input, editor);
        }"""
    )
    page.locator("#typing-input").focus()
    page.keyboard.press("Space")
    assert host.get_attribute("data-era-state") == "reading"

    page.locator("#typing-editor").focus()
    page.keyboard.press("Space")
    assert host.get_attribute("data-era-state") == "reading"

    page.evaluate(
        """() => document.dispatchEvent(new KeyboardEvent('keydown', {
            key: ' ', code: 'Space', repeat: true, bubbles: true, composed: true,
        }))"""
    )
    assert host.get_attribute("data-era-state") == "reading"

    page.evaluate(
        """() => {
            const recorder = window.mountRecorder('keyboard-recorder');
            recorder.querySelector('button').addEventListener('click', () => {
                window.platformRecorderKeyboardClicks =
                    (window.platformRecorderKeyboardClicks ?? 0) + 1;
            });
        }"""
    )
    page.wait_for_function(
        "document.querySelector('#keyboard-recorder')?.dataset.eraRecorderDocked === 'true'"
    )
    page.locator("#keyboard-recorder button").focus()
    page.keyboard.press("Space")
    assert host.get_attribute("data-era-state") == "reading"
    assert page.evaluate("window.platformRecorderKeyboardClicks") == 1

    page.evaluate("document.activeElement?.blur()")
    page.keyboard.press("Space")
    assert host.get_attribute("data-era-state") == "pause"
    page.keyboard.press("Space")
    assert host.get_attribute("data-era-state") == "pause"
    assert errors == []
    page.close()


def test_absolute_red_deadline(context) -> None:
    page, errors = open_case(context, "deadline")
    host = host_for(page)
    advance_to_red_turn(page)

    started = time.monotonic()
    host.get_by_role("button", name="开始 5 秒").click()
    before = float(host.locator("[data-testid='countdown']").inner_text())
    page.evaluate(
        """() => {
            const until = performance.now() + 2200;
            while (performance.now() < until) { /* deliberately block the main thread */ }
        }"""
    )
    page.wait_for_timeout(80)
    after = float(host.locator("[data-testid='countdown']").inner_text())

    assert before >= 4.8
    assert after <= 3.0
    assert host.get_attribute("data-era-state") == "post-red"
    page.keyboard.press("Space")
    assert host.get_attribute("data-era-state") == "post-red"
    page.wait_for_function(
        "document.querySelector('#english-recording-assistant-root')?.dataset.eraState === 'pause'",
        timeout=4_000,
    )
    elapsed = time.monotonic() - started
    assert 4.8 <= elapsed <= 5.8
    assert errors == []
    page.close()


def test_spa_body_replacement_during_timer(context) -> None:
    page, errors = open_case(context, "spa")
    host = host_for(page)
    advance_to_red_turn(page)
    page.evaluate("window.mountRecorder()")
    page.wait_for_function(
        "document.querySelector('#real-recorder')?.dataset.eraRecorderDocked === 'true'"
    )

    host.get_by_role("button", name="开始 5 秒").click()
    page.wait_for_timeout(300)
    page.evaluate(
        """() => {
            const replacement = document.body.cloneNode(true);
            const recorder = replacement.querySelector('#real-recorder');
            recorder.id = 'replacement-recorder';
            recorder.removeAttribute('data-era-recorder-docked');
            window.__eraReplacementBody = replacement;
            document.body.replaceChildren();
        }"""
    )

    page.wait_for_timeout(350)
    assert host.get_attribute("data-era-state") == "post-red"
    assert host.get_attribute("data-era-turn") == "3"
    page.evaluate("document.body.replaceWith(window.__eraReplacementBody)")

    page.wait_for_function(
        "document.querySelector('#replacement-recorder')?.dataset.eraRecorderDocked === 'true'",
        timeout=2_000,
    )
    assert host.get_attribute("data-era-state") == "post-red"
    assert host.get_attribute("data-era-turn") == "3"
    assert page.locator("#english-recording-assistant-root").count() == 1

    page.evaluate(
        """() => {
            for (let index = 0; index < 20; index += 1) {
                const marker = document.createElement('i');
                marker.textContent = String(index);
                document.body.append(marker);
            }
        }"""
    )
    page.wait_for_timeout(300)
    assert page.locator("#english-recording-assistant-root").count() == 1
    assert host.get_attribute("data-era-state") == "post-red"
    assert errors == []
    page.close()


def test_invalid_pause_stops_instead_of_guessing(context) -> None:
    page, errors = open_case(context, "invalid-pause")
    host = host_for(page)
    original = page.locator("#real-script p").first.inner_text()

    page.locator("#real-script p").first.evaluate(
        "element => { element.textContent = element.textContent.replace(/——[0-9.]+s/, ''); }"
    )
    page.wait_for_function(
        "document.querySelector('#english-recording-assistant-root')?.dataset.eraState === 'error'"
    )
    panel = host.locator("[data-testid='panel']")
    assert "无法识别剧本" in panel.inner_text()
    assert "缺少句末静音时长" in panel.inner_text()
    assert host.locator("[data-action='primary']").is_hidden()
    page.keyboard.press("Space")
    assert host.get_attribute("data-era-state") == "error"

    page.locator("#real-script p").first.evaluate(
        "(element, text) => { element.textContent = text; }",
        original,
    )
    page.wait_for_function(
        "document.querySelector('#english-recording-assistant-root')?.dataset.eraState === 'reading'"
    )
    assert host.get_attribute("data-era-turn") == "1"
    assert errors == []
    page.close()


def test_attribute_and_text_mutations_are_observed(context) -> None:
    page, errors = open_case(context, "mutations")
    host = host_for(page)

    page.evaluate(
        """() => {
            const recorder = window.mountRecorder('hidden-recorder');
            recorder.hidden = true;
        }"""
    )
    page.wait_for_timeout(300)
    assert page.locator("#hidden-recorder").get_attribute("data-era-recorder-docked") is None
    page.locator("#hidden-recorder").evaluate("element => { element.hidden = false; }")
    page.wait_for_function(
        "document.querySelector('#hidden-recorder')?.dataset.eraRecorderDocked === 'true'",
        timeout=2_000,
    )

    page.locator("#real-script p").first.evaluate(
        """element => {
            const suffix = [...element.childNodes].findLast((node) => node.nodeType === Node.TEXT_NODE);
            suffix.data = suffix.data.replace(/——[0-9.]+s/, '');
        }"""
    )
    page.wait_for_function(
        "document.querySelector('#english-recording-assistant-root')?.dataset.eraState === 'error'",
        timeout=2_000,
    )
    assert "缺少句末静音时长" in host.locator("[data-testid='panel']").inner_text()
    assert errors == []
    page.close()


def test_continuous_mutations_do_not_starve_rescan(context) -> None:
    page, errors = open_case(context, "continuous-mutations")
    page.evaluate(
        """() => {
            const churn = document.createElement('div');
            churn.id = 'continuous-churn';
            document.body.append(churn);
            let tick = 0;
            const interval = setInterval(() => {
                churn.style.opacity = tick % 2 ? '0.99' : '1';
                tick += 1;
            }, 25);
            setTimeout(() => window.mountRecorder('churn-recorder'), 100);
            setTimeout(() => clearInterval(interval), 1200);
        }"""
    )
    page.wait_for_function(
        "document.querySelector('#churn-recorder')?.dataset.eraRecorderDocked === 'true'",
        timeout=700,
    )
    assert errors == []
    page.close()


def test_effective_zoom_viewports(context) -> None:
    page, errors = open_case(context, "viewport")
    host = host_for(page)
    intro = host.locator("[data-testid='intro']")
    if intro.is_visible():
        intro.get_by_role("button", name="知道了").click()
    page.evaluate("window.mountRecorder()")
    page.wait_for_function(
        "document.querySelector('#real-recorder')?.dataset.eraRecorderDocked === 'true'"
    )

    effective_viewports = (
        (1024, 768, "100%"),
        (819, 614, "125%"),
        (512, 384, "200%"),
    )
    for width, height, label in effective_viewports:
        page.set_viewport_size({"width": width, "height": height})
        for scroll_y in (0, 2500, 99999):
            page.evaluate("value => scrollTo(0, value)", scroll_y)
            assistant_box = assert_inside_viewport(page, "#english-recording-assistant-root")
            recorder_box = assert_inside_viewport(page, "#real-recorder")
            assert not boxes_overlap(assistant_box, recorder_box), (
                f"assistant overlaps recorder at {label}, scroll={scroll_y}"
            )

    advance_to_red_turn(page)
    assistant_box = assert_inside_viewport(page, "#english-recording-assistant-root")
    recorder_box = assert_inside_viewport(page, "#real-recorder")
    assert not boxes_overlap(assistant_box, recorder_box)
    host.get_by_role("button", name="开始 5 秒").click()
    page.wait_for_timeout(80)
    assistant_box = assert_inside_viewport(page, "#english-recording-assistant-root")
    recorder_box = assert_inside_viewport(page, "#real-recorder")
    assert not boxes_overlap(assistant_box, recorder_box)
    page.screenshot(path=str(ARTIFACTS / "recording-assistant-zoom-200.png"))

    assert errors == []
    page.close()


def main() -> None:
    ARTIFACTS.mkdir(exist_ok=True)
    fixture = (
        FIXTURE.read_text(encoding="utf-8")
        .replace("——6s", "——0.15s")
        .replace("——9s", "——0.15s")
        .replace("——7s", "——1s")
    )

    with TemporaryDirectory(prefix="era-adversarial-") as profile, sync_playwright() as playwright:
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
        for initial_page in list(context.pages):
            initial_page.close()

        test_keyboard_guards(context)
        test_absolute_red_deadline(context)
        test_spa_body_replacement_during_timer(context)
        test_invalid_pause_stops_instead_of_guessing(context)
        test_attribute_and_text_mutations_are_observed(context)
        test_continuous_mutations_do_not_starve_rescan(context)
        test_effective_zoom_viewports(context)
        context.close()

    print("Adversarial extension checks passed: input guards, deadlines, SPA, and zoom")


if __name__ == "__main__":
    main()
