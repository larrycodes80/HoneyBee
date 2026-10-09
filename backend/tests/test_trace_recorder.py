import uuid
from app.models.run import Run
from app.models.trace_event import TraceEvent
from app.services.trace_recorder import TraceRecorder


def test_events_have_unique_ids_and_strictly_increasing_sequence_numbers(test_db):
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    run = Run(
        id=run_id,
        status="running",
        config={"scenario": "test"},
        summary={"event_count": 0, "tool_call_count": 0, "error_count": 0},
    )
    test_db.add(run)
    test_db.commit()

    recorder = TraceRecorder(db=test_db, run=run)

    evt1 = recorder.record_event(type="agent_start", name="agent_start")
    evt2 = recorder.record_event(type="tool_call", name="check_fraud", input={"order_id": "123"})
    evt3 = recorder.record_event(type="tool_result", name="check_fraud", output={"status": "ok"})
    evt4 = recorder.record_event(type="error", name="test_error", output={"message": "fail"})
    evt5 = recorder.record_event(type="agent_end", name="agent_end")

    events = recorder.get_events()
    assert len(events) == 5

    # Check unique IDs
    ids = [e.id for e in events]
    assert len(ids) == len(set(ids))

    # Check strictly increasing sequences starting at 1
    sequences = [e.sequence for e in events]
    assert sequences == [1, 2, 3, 4, 5]

    # Verify run summary counts
    assert run.summary["event_count"] == 5
    assert run.summary["tool_call_count"] == 1
    assert run.summary["error_count"] == 1


def test_trace_recorder_with_run_id_string(test_db):
    run_id = f"run_{uuid.uuid4().hex[:8]}"
    run = Run(
        id=run_id,
        status="running",
        config={"scenario": "test"},
        summary={"event_count": 0, "tool_call_count": 0, "error_count": 0},
    )
    test_db.add(run)
    test_db.commit()

    recorder = TraceRecorder(db=test_db, run=run_id)
    recorder.record_event(type="agent_start", name="start")
    test_db.commit()

    persisted = test_db.query(TraceEvent).filter(TraceEvent.run_id == run_id).all()
    assert len(persisted) == 1
    assert persisted[0].sequence == 1
