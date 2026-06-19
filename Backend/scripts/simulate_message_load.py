"""Run message-load simulation with dummy users through the public API."""

import argparse
import random
import string
import threading
import time
import uuid

import requests


def random_message(length: int):
    alphabet = string.ascii_letters + string.digits + " "
    return "".join(random.choice(alphabet) for _ in range(length)).strip() or "hello"


def login(base_url: str, email: str, password: str):
    response = requests.post(
        f"{base_url}/auth/login",
        json={"email": email, "password": password},
        timeout=20,
    )
    response.raise_for_status()
    data = response.json().get("data", {})
    return {
        "email": email,
        "token": data.get("access_token"),
        "person_id": data.get("person_id"),
    }


def build_accounts(base_url: str, prefix: str, count: int, password: str):
    accounts = []
    for index in range(1, count + 1):
        email = f"{prefix}{index:04d}@example.local"
        try:
            account = login(base_url, email, password)
            if account["token"] and account["person_id"]:
                accounts.append(account)
        except Exception as exc:
            print(f"Skipping {email}: {exc}")
    return accounts


def worker(base_url, accounts, per_worker, min_len, max_len, simulation_run_id, stats, lock):
    local_success = 0
    local_failure = 0

    for _ in range(per_worker):
        sender, recipient = random.sample(accounts, 2)
        message = random_message(random.randint(min_len, max_len))

        try:
            response = requests.post(
                f"{base_url}/messages/conversations",
                headers={
                    "Authorization": f"Bearer {sender['token']}",
                    "X-Simulation-Run-Id": simulation_run_id,
                },
                json={
                    "recipient_person_id": recipient["person_id"],
                    "body": message,
                },
                timeout=20,
            )
            if response.status_code in (200, 201):
                local_success += 1
            else:
                local_failure += 1
        except Exception:
            local_failure += 1

    with lock:
        stats["success"] += local_success
        stats["failure"] += local_failure


def run_simulation(base_url, prefix, count, password, total_messages, workers, min_len, max_len):
    accounts = build_accounts(base_url, prefix, count, password)
    if len(accounts) < 2:
        raise RuntimeError("Need at least 2 authenticated accounts to run simulation")

    simulation_run_id = str(uuid.uuid4())
    print(f"simulation_run_id={simulation_run_id}")
    print(f"authenticated_accounts={len(accounts)}")

    messages_per_worker = max(total_messages // workers, 1)

    stats = {"success": 0, "failure": 0}
    lock = threading.Lock()
    threads = []

    started_at = time.time()
    for _ in range(workers):
        thread = threading.Thread(
            target=worker,
            args=(
                base_url,
                accounts,
                messages_per_worker,
                min_len,
                max_len,
                simulation_run_id,
                stats,
                lock,
            ),
            daemon=True,
        )
        thread.start()
        threads.append(thread)

    for thread in threads:
        thread.join()

    duration_seconds = max(time.time() - started_at, 0.001)
    total_sent = stats["success"] + stats["failure"]
    print("--- simulation summary ---")
    print(f"total_attempted={total_sent}")
    print(f"success={stats['success']}")
    print(f"failure={stats['failure']}")
    print(f"duration_seconds={duration_seconds:.2f}")
    print(f"throughput_msgs_per_sec={stats['success'] / duration_seconds:.2f}")
    print(f"simulation_run_id={simulation_run_id}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Simulate message traffic through API endpoints")
    parser.add_argument("--base-url", default="http://backend:5001", help="Backend base URL")
    parser.add_argument("--prefix", default="simuser", help="Dummy account email prefix")
    parser.add_argument("--count", type=int, default=50, help="Number of dummy accounts to authenticate")
    parser.add_argument("--password", default="SimPass1234", help="Dummy account password")
    parser.add_argument("--total-messages", type=int, default=1000, help="Total messages to attempt")
    parser.add_argument("--workers", type=int, default=10, help="Parallel workers")
    parser.add_argument("--min-len", type=int, default=20, help="Minimum message length")
    parser.add_argument("--max-len", type=int, default=180, help="Maximum message length")
    args = parser.parse_args()

    run_simulation(
        args.base_url,
        args.prefix,
        args.count,
        args.password,
        args.total_messages,
        args.workers,
        args.min_len,
        args.max_len,
    )
