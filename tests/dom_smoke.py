from pathlib import Path
from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = ROOT / "tests" / "fixtures" / "platform.html"
CORE = ROOT / "extension" / "core.js"
DOM = ROOT / "extension" / "dom.js"
CHROME_CANDIDATES = (
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
)


def main() -> None:
    executable = next((path for path in CHROME_CANDIDATES if path.exists()), None)
    if executable is None:
        raise RuntimeError("Chrome or Edge executable was not found for browser tests.")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=str(executable))
        page = browser.new_page(viewport={"width": 1280, "height": 720})
        page.goto(FIXTURE.as_uri())
        page.wait_for_load_state("networkidle")
        page.add_script_tag(path=str(CORE))
        page.add_script_tag(path=str(DOM))

        initial = page.evaluate(
            """() => {
                const result = globalThis.RecordingAssistantDom.scanPage(document);
                return {
                    scriptId: result.scriptRoot?.id ?? null,
                    turnCount: result.turns.length,
                    redText: result.turns[2]?.redText ?? null,
                    recorderId: result.recorderRoot?.id ?? null,
                    issues: result.issues,
                };
            }"""
        )
        assert initial == {
            "scriptId": "real-script",
            "turnCount": 3,
            "redText": "I am agree",
            "recorderId": None,
            "issues": [
                {
                    "code": "recorder-not-found",
                    "message": "尚未发现原平台录音控件。",
                }
            ],
        }

        docked = page.evaluate(
            """() => {
                const original = window.mountRecorder();
                original.sentinel = 'same-node';
                const result = globalThis.RecordingAssistantDom.scanPage(document);
                globalThis.RecordingAssistantDom.dockRecorder(result.recorderRoot);
                return {
                    recorderId: result.recorderRoot?.id ?? null,
                    sameNode: result.recorderRoot === original,
                    sentinel: original.sentinel,
                    docked: original.dataset.eraRecorderDocked,
                    unrelatedDocked: document.querySelector('#recording-help').dataset.eraRecorderDocked ?? null,
                };
            }"""
        )
        assert docked == {
            "recorderId": "real-recorder",
            "sameNode": True,
            "sentinel": "same-node",
            "docked": "true",
            "unrelatedDocked": None,
        }

        replaced = page.evaluate(
            """() => {
                const oldRecorder = document.querySelector('#real-recorder');
                const replacement = window.mountRecorder('replacement-recorder');
                const result = globalThis.RecordingAssistantDom.scanPage(document);
                globalThis.RecordingAssistantDom.dockRecorder(result.recorderRoot);
                return {
                    oldConnected: oldRecorder.isConnected,
                    replacementFound: result.recorderRoot === replacement,
                    replacementDocked: replacement.dataset.eraRecorderDocked,
                };
            }"""
        )
        assert replaced == {
            "oldConnected": False,
            "replacementFound": True,
            "replacementDocked": "true",
        }

        browser.close()
    print("DOM smoke: 3 adversarial scenarios passed")


if __name__ == "__main__":
    main()

