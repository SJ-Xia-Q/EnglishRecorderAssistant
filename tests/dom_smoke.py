import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", str(ROOT / ".playwright-browsers"))

from playwright.sync_api import sync_playwright


FIXTURE = ROOT / "tests" / "fixtures" / "platform.html"
CORE = ROOT / "extension" / "core.js"
DOM = ROOT / "extension" / "dom.js"


def main() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="chromium", headless=True)
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
                    decoyDocked: document.querySelector('#recording-decoy').dataset.eraRecorderDocked ?? null,
                };
            }"""
        )
        assert docked == {
            "recorderId": "real-recorder",
            "sameNode": True,
            "sentinel": "same-node",
            "docked": "true",
            "unrelatedDocked": None,
            "decoyDocked": None,
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

        accessible_control = page.evaluate(
            """() => {
                const recorder = document.createElement('div');
                recorder.id = 'accessible-recorder';
                recorder.className = 'recorder';
                recorder.innerHTML = [
                    '<button type="button" aria-label="暂停录音"><span aria-hidden="true">■</span></button>',
                    '<output aria-label="录音时长">00:07</output>',
                ].join('');
                document.querySelector('#recorder-slot').replaceChildren(recorder);
                const result = globalThis.RecordingAssistantDom.scanPage(document);
                globalThis.RecordingAssistantDom.dockRecorder(result.recorderRoot);
                return {
                    found: result.recorderRoot === recorder,
                    docked: recorder.dataset.eraRecorderDocked ?? null,
                };
            }"""
        )
        assert accessible_control == {"found": True, "docked": "true"}

        browser.close()
    print("DOM smoke: 4 adversarial scenarios passed")


if __name__ == "__main__":
    main()

