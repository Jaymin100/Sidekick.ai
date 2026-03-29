from uuid import uuid4

from flask import Blueprint, current_app, request, Response, jsonify

from infra.redis.utils.channel_builder import workflow_events_channel

from apps.backend.core.enums.workflow_status import WorkflowStatus

task_bp = Blueprint("task", __name__, url_prefix="/task")


@task_bp.post("/generate")
def generate_task():
    data = request.get_json(silent=True) or {}

    object_key = data.get("object_key")
    site_url = data.get("site_url")
    page_title = data.get("page_title")

    if not object_key:
        return jsonify({"error": "object_key is required"}), 400

    if not site_url:
        return jsonify({"error": "site_url is required"}), 400

    if not page_title:
        return jsonify({"error": "page_title is required"}), 400
    
    workflow_id = str(uuid4())
    
    workflow_state_service = current_app.config["workflow_state_service"]
    workflow_event_service = current_app.config["workflow_event_service"]

    state = workflow_state_service.create_workflow_state(
        workflow_id=workflow_id
    )

    workflow_event_service.publish_status_updated(
        workflow_id=workflow_id,
        status=WorkflowStatus.QUEUED,
    )

    return jsonify({
        "workflow_id": state["workflow_id"],
        "status": state["status"]
    }), 202


@task_bp.get("/<workflow_id>/events")
def stream_task_events(workflow_id: str):
    redis_service = current_app.config["redis_service"]

    def event_stream():
        pubsub = redis_service.get_pubsub()
        channel = workflow_events_channel(workflow_id)
        pubsub.subscribe(channel)

        try:
            for message in pubsub.listen():
                if message["type"] != "message":
                    continue

                yield f"data: {message['data']}\n\n"
        finally:
            pubsub.unsubscribe(channel)
            pubsub.close()

    return Response(
        event_stream(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )

@task_bp.get("/<workflow_id>")
def get_task(workflow_id: str):
    workflow_state_service = current_app.config["workflow_state_service"]
    state = workflow_state_service.get_workflow_state(workflow_id)

    if state is None:
        return jsonify({"error": "workflow not found"}), 404

    return jsonify(state), 200
