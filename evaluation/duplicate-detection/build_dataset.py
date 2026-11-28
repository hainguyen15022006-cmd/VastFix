"""Build the independent, fully synthetic Checkpoint 1 review fixture."""

import json
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parent
NAMESPACE = "vastfix/cong-thanh/checkpoint1/"


def uid(kind, name):
    return str(uuid5(NAMESPACE_URL, NAMESPACE + kind + "/" + name))


PLACES = {
    "a1_hall2": ("A1", "2", "HALL", "INDOOR"),
    "a1_lab2": ("A1", "2", "LAB", "INDOOR"),
    "a1_hall3": ("A1", "3", "HALL", "INDOOR"),
    "a1_toilet2": ("A1", "2", "TOILET", "INDOOR"),
    "a2_hall2": ("A2", "2", "HALL", "INDOOR"),
    "b1_hall1": ("B1", "1", "HALL", "INDOOR"),
    "b1_room1": ("B1", "1", "ROOM", "INDOOR"),
    "gate": (None, None, None, "OUTDOOR"),
    "yard": (None, None, None, "OUTDOOR"),
}
CATEGORIES = ["ELECTRICAL", "PLUMBING", "HVAC", "IT", "CIVIL", "CLEANING"]
REPORTS = []


def add(key, incident, language, place, category, detail, time, description,
        status="SUBMITTED", closed_at=None, merged_source=False):
    building, floor, area, kind = PLACES[place]
    if kind == "INDOOR":
        location = {
            "kind": kind, "building_id": uid("building", building),
            "floor_id": uid("floor", building + "/" + floor),
            "area_id": uid("area", building + "/" + floor + "/" + area),
            "detail": detail,
        }
    else:
        location = {"kind": kind, "detail": detail, "latitude": None, "longitude": None}
    REPORTS.append({
        "key": key, "report_id": uid("report", key), "issue_id": uid("issue", key),
        "incident_key": incident, "language": language, "description": description,
        "category_code": category, "location": location, "created_at": time,
        "issue_status": status, "closed_at": closed_at,
        "merged_source": merged_source, "provenance": "SYNTHETIC_CODEX_2026-11-19",
    })


add("light03_vi", "light03_nov", "vi", "a1_hall2", "ELECTRICAL", "H2-03", "2026-11-18T08:00:00Z", "Đèn H2-03 ở hành lang tầng 2 tòa A1 không sáng")
add("light03_en", "light03_nov", "en", "a1_hall2", "ELECTRICAL", "H2-03", "2026-11-18T08:30:00Z", "Light H2-03 in the A1 second-floor corridor is out")
add("light03_typo", "light03_nov", "vi", "a1_hall2", "ELECTRICAL", "H2-03", "2026-11-18T09:00:00Z", "den H2-03 hanh lang tang 2 khong sang")
add("light04", "light04_nov", "vi", "a1_hall2", "ELECTRICAL", "H2-04", "2026-11-18T08:05:00Z", "Đèn H2-04 ở hành lang tầng 2 tòa A1 không sáng")
add("light03_flicker", "light03_flicker", "vi", "a1_hall2", "ELECTRICAL", "H2-03", "2026-11-18T08:10:00Z", "Đèn H2-03 hành lang tầng 2 nhấp nháy nhưng vẫn sáng")
add("light03_old", "light03_oct", "vi", "a1_hall2", "ELECTRICAL", "H2-03", "2026-10-01T08:00:00Z", "Đèn H2-03 hành lang tầng 2 không sáng", "CLOSED", "2026-10-03T10:00:00Z")
add("light03_old_en", "light03_oct", "en", "a1_hall2", "ELECTRICAL", "H2-03", "2026-10-01T09:00:00Z", "The H2-03 corridor lamp is dark", "CLOSED", "2026-10-03T10:00:00Z")
add("light03_recur", "light03_nov", "vi", "a1_hall2", "ELECTRICAL", "H2-03", "2026-11-18T10:00:00Z", "Bóng H2-03 lại tắt ở hành lang A1 tầng hai")
add("light03_merged", "light03_nov", "en", "a1_hall2", "ELECTRICAL", "H2-03", "2026-11-18T08:40:00Z", "H2-03 ceiling light has stopped working", merged_source=True)
add("light03_a2", "light03_a2", "vi", "a2_hall2", "ELECTRICAL", "H2-03", "2026-11-18T08:15:00Z", "Đèn H2-03 hành lang tầng 2 tòa A2 không sáng")
add("light03_floor3", "light03_floor3", "vi", "a1_hall3", "ELECTRICAL", "H2-03", "2026-11-18T08:20:00Z", "Đèn H2-03 hành lang tầng 3 tòa A1 không sáng")
add("projector", "projector", "en", "a1_lab2", "IT", "projector P-2", "2026-11-18T07:00:00Z", "Projector P-2 in A1 lab 2 shows no image")
add("projector_vi", "projector", "vi", "a1_lab2", "IT", "projector P-2", "2026-11-18T07:45:00Z", "Máy chiếu P-2 trong phòng thực hành A1 không lên hình")
add("projector_remote", "projector_remote", "en", "a1_lab2", "IT", "projector P-2 remote", "2026-11-18T07:20:00Z", "Projector P-2 remote in A1 lab 2 has dead batteries")
add("ac_leak", "ac_leak", "vi", "a1_lab2", "HVAC", "AC-2", "2026-11-18T06:00:00Z", "Điều hòa AC-2 phòng thực hành A1 chảy nước")
add("ac_leak_en", "ac_leak", "en", "a1_lab2", "HVAC", "AC-2", "2026-11-18T07:30:00Z", "Water drips from AC-2 in the A1 lab")
add("ac_noise", "ac_noise", "vi", "a1_lab2", "HVAC", "AC-2", "2026-11-18T06:10:00Z", "Điều hòa AC-2 phòng thực hành A1 kêu to")
add("tap", "tap", "vi", "a1_toilet2", "PLUMBING", "vòi rửa số 1", "2026-11-18T05:00:00Z", "Vòi rửa số 1 nhà vệ sinh A1 tầng 2 rò nước")
add("tap_en", "tap", "en", "a1_toilet2", "PLUMBING", "sink tap 1", "2026-11-18T05:40:00Z", "Sink tap 1 leaks in the A1 second-floor restroom")
add("tap2", "tap2", "vi", "a1_toilet2", "PLUMBING", "vòi rửa số 2", "2026-11-18T05:10:00Z", "Vòi rửa số 2 nhà vệ sinh A1 tầng 2 rò nước")
add("drain", "drain", "vi", "a1_toilet2", "PLUMBING", "thoát sàn", "2026-11-18T05:15:00Z", "Nước đọng do cống sàn nhà vệ sinh A1 tầng 2 bị tắc")
add("wifi", "wifi", "en", "b1_room1", "IT", "Wi-Fi room 101", "2026-11-18T04:00:00Z", "Wi-Fi in B1 room 101 disconnects repeatedly")
add("wifi_vi", "wifi", "vi", "b1_room1", "IT", "Wi-Fi room 101", "2026-11-18T04:30:00Z", "Mạng wifi phòng 101 B1 rớt liên tục")
add("wifi_room102", "wifi_room102", "en", "b1_room1", "IT", "Wi-Fi room 102", "2026-11-18T04:10:00Z", "Wi-Fi in B1 room 102 disconnects repeatedly")
add("door", "door", "vi", "b1_hall1", "CIVIL", "cửa D1", "2026-11-18T03:00:00Z", "Cửa D1 hành lang B1 tầng một không đóng kín")
add("door_en", "door", "en", "b1_hall1", "CIVIL", "door D1", "2026-11-18T03:35:00Z", "Door D1 on B1 ground floor does not latch")
add("door_en_again", "door", "en", "b1_hall1", "CIVIL", "door D1", "2026-11-18T03:50:00Z", "The D1 hallway door in B1 still will not close")
add("door2", "door2", "en", "b1_hall1", "CIVIL", "door D2", "2026-11-18T03:10:00Z", "Door D2 on B1 ground floor does not latch")
add("gate_light", "gate_light", "vi", "gate", "ELECTRICAL", "cổng chính 18-2", "2026-11-18T02:00:00Z", "Đèn ở cổng chính 18-2 không sáng")
add("gate_light_en", "gate_light", "en", "gate", "ELECTRICAL", "cổng chính 18-2", "2026-11-18T02:30:00Z", "The light at the main 18-2 gate is out")
add("gate_camera", "gate_camera", "vi", "gate", "IT", "cổng chính 18-2", "2026-11-18T02:10:00Z", "Camera ở cổng chính 18-2 không hoạt động")
add("yard_puddle", "yard_puddle", "vi", "yard", "PLUMBING", "sân trước A1", "2026-11-18T01:00:00Z", "Nước đọng trên sân trước A1 do ống tưới rò")
add("yard_puddle_en", "yard_puddle", "en", "yard", "PLUMBING", "sân trước A1", "2026-11-18T02:40:00Z", "Irrigation pipe leaks onto the yard in front of A1")
add("yard_litter", "yard_litter", "en", "yard", "CLEANING", "sân trước A1", "2026-11-18T01:10:00Z", "Litter has accumulated in the yard in front of A1")
add("hall_dirty", "hall_dirty", "vi", "a1_hall2", "CLEANING", "hành lang giữa", "2026-11-18T00:00:00Z", "Hành lang giữa A1 tầng 2 có rác cần dọn")
add("hall_dirty_en", "hall_dirty", "en", "a1_hall2", "CLEANING", "hành lang giữa", "2026-11-18T00:30:00Z", "There is litter in the middle corridor on A1 floor 2")
add("hall_wet", "hall_wet", "vi", "a1_hall2", "CLEANING", "hành lang giữa", "2026-11-18T00:15:00Z", "Hành lang giữa A1 tầng 2 bị ướt cần lau")
add("short_light", "light03_nov", "vi", "a1_hall2", "ELECTRICAL", "H2-03", "2026-11-18T11:00:00Z", "H2-03 hỏng")
add("ambiguous", "unknown", "vi", "a1_hall2", "ELECTRICAL", None, "2026-11-18T11:10:00Z", "Đèn hỏng")
add("new_no_candidates", "isolated", "en", "b1_room1", "CIVIL", "window W7", "2026-11-18T12:00:00Z", "Window W7 is cracked")
add("lab_socket", "socket", "en", "a1_lab2", "ELECTRICAL", "socket S1", "2026-11-18T07:30:00Z", "Socket S1 in A1 lab has no power")

CASES = []


def case(key, query, candidates, relevant, scenario, rationale, uncertain=False):
    CASES.append({
        "case_id": key, "query_id": uid("report", query),
        "candidate_ids": [uid("report", c) for c in candidates],
        "expected_relevant_ids": [uid("report", c) for c in relevant],
        "expected_negative_ids": [uid("report", c) for c in candidates if c not in relevant],
        "scenario": scenario, "rationale": rationale,
        "provenance": "SYNTHETIC_CODEX_2026-11-19",
        "review_status": "UNCERTAIN" if uncertain else "PROVISIONAL",
    })


case("C01", "light03_en", ["light03_vi", "light04", "light03_flicker"], ["light03_vi"], "vi-en", "Same H2-03 outage; H2-04 is another lamp and flickering is another fault.")
case("C02", "light03_typo", ["light03_vi", "light03_en", "light04"], ["light03_vi", "light03_en"], "vi-vi typo", "Unaccented typo describes the same H2-03 outage.")
case("C03", "light03_recur", ["light03_vi", "light03_en", "light03_old", "light03_merged", "light04"], ["light03_vi", "light03_en", "light03_merged"], "closed recurrence merged", "October repair is a separate occurrence; merged source is incident-level relevant but backend-ineligible.")
case("C04", "light03_recur", ["light03_old", "light03_old_en"], [], "closed only", "Both October reports refer to a repaired occurrence, not the November outage.")
case("C05", "light03_en", ["light03_a2", "light03_floor3", "light04"], [], "different building floor equipment", "Same identifiers or wording in another place do not identify this incident.")
case("C06", "projector_vi", ["projector", "projector_remote", "ac_leak"], ["projector"], "vi-en same location", "Projector image failure is the same occurrence; remote battery fault differs.")
case("C07", "ac_leak_en", ["ac_leak", "ac_noise", "projector"], ["ac_leak"], "vi-en same equipment different issue", "Water leak and loud noise are distinct AC-2 faults.")
case("C08", "tap_en", ["tap", "tap2", "drain"], ["tap"], "vi-en hard negative", "Tap 1 leak matches; tap 2 and drain are different objects.")
case("C09", "wifi_vi", ["wifi", "wifi_room102", "door"], ["wifi"], "vi-en room distinction", "Room 101 outage differs from room 102 despite matching symptoms.")
case("C10", "door_en", ["door", "door2"], ["door"], "vi-en hard negative", "Door D1 and D2 have similar faults but are separate objects.")
case("C11", "gate_light_en", ["gate_light", "gate_camera", "yard_puddle"], ["gate_light"], "outdoor vi-en", "Same gate light; camera and yard faults are unrelated.")
case("C12", "yard_puddle_en", ["yard_puddle", "yard_litter", "gate_camera"], ["yard_puddle"], "outdoor vi-en", "Same leaking irrigation pipe; litter and camera are unrelated.")
case("C13", "hall_dirty_en", ["hall_dirty", "hall_wet"], ["hall_dirty"], "vi-en same area different issue", "Litter and water are distinct issues in one area.")
case("C14", "short_light", ["light03_vi", "light04", "light03_flicker"], ["light03_vi"], "short description", "The asset ID and scenario establish the same outage despite little text.")
case("C15", "new_no_candidates", [], [], "empty candidates", "No prior candidate is supplied.")
case("C16", "ambiguous", ["light03_vi", "light04"], [], "ambiguous", "The description does not identify a lamp or occurrence; human review is needed.", True)
case("C17", "light03_en", ["light03_old", "light03_old_en"], [], "closed prior occurrence", "October repair is a previous incident even with identical equipment.")
case("C18", "light03_recur", ["light03_merged", "light03_vi"], ["light03_merged", "light03_vi"], "merged source", "Both reports describe the same outage; only the unmerged Issue is backend-eligible.")
case("C19", "lab_socket", ["ac_leak", "projector", "ac_noise"], [], "en-en no duplicate", "A socket fault differs from the other lab equipment faults.")
case("C20", "light03_en", ["light03_vi", "light03_a2", "light03_floor3", "light04", "light03_flicker", "hall_dirty"], ["light03_vi"], "mixed ranking", "One true duplicate competes with similar descriptions and nearby issues.")
case("C21", "door_en_again", ["door_en", "door", "door2"], ["door_en", "door"], "en-en and en-vi", "Both D1 descriptions are the same latch fault; D2 is another door.")
case("C22", "door_en_again", ["door_en", "door2"], ["door_en"], "en-en hard negative", "D1 and D2 are separate doors despite similar English descriptions.")


def main():
    dataset = {
        "schema_version": 1,
        "provenance": "SYNTHETIC_CODEX_2026-11-19",
        "categories": [{"code": c, "source": "synthetic evaluation catalog"} for c in CATEGORIES],
        "places": {key: {"building": b, "floor": f, "area": a, "kind": kind}
                   for key, (b, f, a, kind) in PLACES.items()},
        "reports": REPORTS, "cases": CASES,
    }
    (ROOT / "dataset.json").write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
