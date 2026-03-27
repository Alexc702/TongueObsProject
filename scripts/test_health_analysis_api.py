#!/opt/homebrew/bin/python3

import argparse
import hashlib
import hmac
import json
import mimetypes
import os
import sys
import time
import uuid
from pathlib import Path
from urllib import error, request


DEFAULT_HOST = "https://open.lifeemergence.com"
START_PATH = "/smyx-open-api/open/health-analysis/v1/start-face-analysis"
QUERY_PATH = "/smyx-open-api/open/health-analysis/v1/query-face-analysis-json"


def sha256_hex_of_json(payload):
    encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def build_signature(access_key, secret, method, timestamp, nonce, algorithm, request_body=None):
    lines = [method.upper()]
    if request_body is not None:
        lines.append(sha256_hex_of_json(request_body))
    string_to_sign = "\n".join(lines)
    auth_factor = f"{access_key}{timestamp}{nonce}{string_to_sign}".encode("utf-8")
    digestmod = hashlib.sha256 if algorithm == "sha256" else hashlib.sha512
    return hmac.new(secret.encode("utf-8"), auth_factor, digestmod).hexdigest().upper()


def build_multipart_body(file_path):
    boundary = f"----CodexBoundary{uuid.uuid4().hex}"
    filename = file_path.name
    content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
    file_bytes = file_path.read_bytes()

    body = bytearray()
    body.extend(f"--{boundary}\r\n".encode("utf-8"))
    body.extend(
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'.encode("utf-8")
    )
    body.extend(f"Content-Type: {content_type}\r\n\r\n".encode("utf-8"))
    body.extend(file_bytes)
    body.extend(f"\r\n--{boundary}--\r\n".encode("utf-8"))
    return boundary, bytes(body)


def post(url, headers, body):
    req = request.Request(url, data=body, headers=headers, method="POST")
    try:
        with request.urlopen(req, timeout=60) as resp:
            status = resp.status
            raw = resp.read().decode("utf-8", errors="replace")
    except error.HTTPError as exc:
        status = exc.code
        raw = exc.read().decode("utf-8", errors="replace")
    return status, raw


def parse_json(raw):
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None


def looks_like_auth_failure(status, raw, payload):
    raw_lower = raw.lower()
    if status in {401, 403}:
        return True
    if isinstance(payload, dict):
        code = str(payload.get("errorCode") or "").lower()
        msg = str(payload.get("errorMsg") or "").lower()
        joined = f"{code} {msg}"
        if any(token in joined for token in ("sign", "signature", "auth", "access key", "nonce", "timestamp")):
            return True
    return any(token in raw_lower for token in ("signature", "accesskey", "access key", "auth"))


def save_text(path, content):
    path.write_text(content, encoding="utf-8")


def save_json(path, content):
    path.write_text(json.dumps(content, ensure_ascii=False, indent=2), encoding="utf-8")


def test_with_algorithm(host, access_key, access_secret, file_path, out_dir, algorithm, poll_interval, max_polls):
    attempt_dir = out_dir / algorithm
    attempt_dir.mkdir(parents=True, exist_ok=True)

    timestamp = str(int(time.time() * 1000))
    nonce = str(uuid.uuid4())
    signature = build_signature(access_key, access_secret, "POST", timestamp, nonce, algorithm, None)
    boundary, multipart_body = build_multipart_body(file_path)
    start_headers = {
        "Content-Type": f"multipart/form-data; boundary={boundary}",
        "X-Access-Key": access_key,
        "X-Timestamp": timestamp,
        "X-Nonce": nonce,
        "X-Signature": signature,
    }

    save_json(
        attempt_dir / "start_request_meta.json",
        {
            "host": host,
            "algorithm": algorithm,
            "file": str(file_path),
            "file_size_bytes": file_path.stat().st_size,
            "headers": {k: ("***" if k in {"X-Access-Key", "X-Signature"} else v) for k, v in start_headers.items()},
        },
    )

    start_status, start_raw = post(f"{host}{START_PATH}", start_headers, multipart_body)
    save_text(attempt_dir / "start_response_raw.txt", start_raw)
    start_payload = parse_json(start_raw)
    if start_payload is not None:
        save_json(attempt_dir / "start_response.json", start_payload)

    if start_payload is None:
        return {
            "algorithm": algorithm,
            "status": start_status,
            "phase": "start",
            "ok": False,
            "message": "start response is not valid JSON",
            "auth_failure": looks_like_auth_failure(start_status, start_raw, None),
        }

    if looks_like_auth_failure(start_status, start_raw, start_payload):
        return {
            "algorithm": algorithm,
            "status": start_status,
            "phase": "start",
            "ok": False,
            "message": "likely auth failure",
            "auth_failure": True,
            "payload": start_payload,
        }

    if not start_payload.get("success"):
        return {
            "algorithm": algorithm,
            "status": start_status,
            "phase": "start",
            "ok": False,
            "message": "start call reached server but returned business failure",
            "auth_failure": False,
            "payload": start_payload,
        }

    analysis_id = ((start_payload.get("data") or {}).get("analysisId"))
    if not analysis_id:
        return {
            "algorithm": algorithm,
            "status": start_status,
            "phase": "start",
            "ok": False,
            "message": "start call succeeded but analysisId missing",
            "auth_failure": False,
            "payload": start_payload,
        }

    polls = []
    final_payload = None
    for idx in range(1, max_polls + 1):
        body_payload = {"analysisId": analysis_id}
        body_bytes = json.dumps(body_payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
        timestamp = str(int(time.time() * 1000))
        nonce = str(uuid.uuid4())
        signature = build_signature(access_key, access_secret, "POST", timestamp, nonce, algorithm, body_payload)
        query_headers = {
            "Content-Type": "application/json",
            "X-Access-Key": access_key,
            "X-Timestamp": timestamp,
            "X-Nonce": nonce,
            "X-Signature": signature,
        }
        query_status, query_raw = post(f"{host}{QUERY_PATH}", query_headers, body_bytes)
        query_payload = parse_json(query_raw)
        poll_record = {
            "poll": idx,
            "status": query_status,
            "raw": query_raw,
            "payload": query_payload,
        }
        polls.append(poll_record)
        save_json(attempt_dir / "query_polls.json", polls)

        if query_payload is None:
            final_payload = {"success": False, "errorMsg": "query response is not valid JSON"}
            break

        if not query_payload.get("success"):
            final_payload = query_payload
            break

        if query_payload.get("data") is not None:
            final_payload = query_payload
            break

        time.sleep(poll_interval)

    if final_payload is not None:
        save_json(attempt_dir / "final_result.json", final_payload)

    return {
        "algorithm": algorithm,
        "status": start_status,
        "phase": "query" if polls else "start",
        "ok": True,
        "analysisId": analysis_id,
        "start_payload": start_payload,
        "final_payload": final_payload,
        "poll_count": len(polls),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--file", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--algorithm", choices=["auto", "sha256", "sha512"], default="auto")
    parser.add_argument("--poll-interval", type=int, default=5)
    parser.add_argument("--max-polls", type=int, default=12)
    args = parser.parse_args()

    access_key = os.environ.get("HEALTH_ACCESS_KEY")
    access_secret = os.environ.get("HEALTH_ACCESS_SECRET")
    if not access_key or not access_secret:
        print("Missing HEALTH_ACCESS_KEY or HEALTH_ACCESS_SECRET", file=sys.stderr)
        return 2

    file_path = Path(args.file)
    out_dir = Path(args.output_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    algorithms = ["sha256", "sha512"] if args.algorithm == "auto" else [args.algorithm]
    summary = {"file": str(file_path), "attempts": []}

    for algorithm in algorithms:
        result = test_with_algorithm(
            args.host,
            access_key,
            access_secret,
            file_path,
            out_dir,
            algorithm,
            args.poll_interval,
            args.max_polls,
        )
        summary["attempts"].append(result)
        save_json(out_dir / "summary.json", summary)

        if result.get("ok") and not result.get("auth_failure"):
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 0

        if not result.get("auth_failure"):
            print(json.dumps(result, ensure_ascii=False, indent=2))
            return 1

    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
