from flask import jsonify


def api_error(
    status: int,
    code: str,
    message: str,
    fields: dict[str, str] | None = None,
):
    error: dict[str, object] = {"code": code, "message": message}
    if fields:
        error["fields"] = fields
    return jsonify(error=error), status

