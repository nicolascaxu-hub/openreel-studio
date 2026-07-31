from app.agent.video_mode import build_video_mode_system_reminder


def test_video_mode_reminder_is_coarse_state_only():
    reminder = build_video_mode_system_reminder({"project_mode": "video_production"})

    assert "视频制作" in reminder
    assert "节点字段" in reminder
    assert "references" in reminder
    assert "grid" not in reminder
    assert "frames" not in reminder
    assert "story_template" not in reminder
