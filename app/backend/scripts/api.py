#!/usr/bin/env python3
from __future__ import annotations

import os
from typing import Any, Dict

from dotenv import load_dotenv
from flask import Flask, jsonify, request

from leadfinder import main as leadfinder_main
from outreach_messages import main as outreach_main


def create_app() -> Flask:
    load_dotenv()
    app = Flask(__name__)

    @app.route("/health", methods=["GET"])
    def health() -> Any:
        return jsonify({"status": "ok"})

    @app.route("/search", methods=["POST"])
    def search() -> Any:
        data: Dict[str, Any] = request.get_json(force=True) or {}
        query = data.get("query", "")
        engine = data.get("engine", "google")
        limit = int(data.get("limit", 25))
        out = data.get("out", "leads.csv")
        write_messages = bool(data.get("write_messages", False))

        argv = [
            "--query", query,
            "--engine", engine,
            "--limit", str(limit),
            "--out", out,
        ]
        if write_messages:
            argv.append("--write-messages")
        leadfinder_main(argv)
        return jsonify({"ok": True, "out": out})

    @app.route("/outreach", methods=["POST"])
    def outreach() -> Any:
        data: Dict[str, Any] = request.get_json(force=True) or {}
        csv_path = data.get("csv", "leads.csv")
        services = data.get("services")
        overwrite = bool(data.get("overwrite", False))
        model = data.get("model", "gemini-1.5-flash")
        max_chars = int(data.get("max_chars", 300))
        sleep_s = float(data.get("sleep", 0.75))
        goal = data.get("goal", "")

        argv = [
            "--csv", csv_path,
            "--model", model,
            "--max-chars", str(max_chars),
            "--sleep", str(sleep_s),
        ]
        if services:
            argv += ["--services", services]
        if overwrite:
            argv.append("--overwrite")
        if goal:
            argv += ["--goal", goal]

        outreach_main(argv)
        return jsonify({"ok": True, "csv": csv_path})

    return app


if __name__ == "__main__":
    app = create_app()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", "8000")), debug=False)


