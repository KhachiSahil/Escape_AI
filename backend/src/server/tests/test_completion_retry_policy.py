"""Tests for the Groq tool_use_failed retry/fallback policy
(tools/completion_retry_policy.py).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools.completion_retry_policy import CompletionRetryPolicy, RetryAction  # noqa: E402


def test_first_failure_retries():
    policy = CompletionRetryPolicy()
    action = policy.on_error("Error during completion: tool_use_failed")
    assert action is RetryAction.RETRY


def test_second_consecutive_failure_falls_back():
    policy = CompletionRetryPolicy()
    policy.on_error("Error during completion: tool_use_failed")
    action = policy.on_error("Error during completion: tool_use_failed")
    assert action is RetryAction.FALLBACK


def test_falls_back_only_once_then_retries_again_on_a_third_failure():
    """After falling back, the counter resets - a third, independent
    failure should retry again rather than immediately falling back."""
    policy = CompletionRetryPolicy()
    policy.on_error("Error during completion: tool_use_failed")
    policy.on_error("Error during completion: tool_use_failed")
    action = policy.on_error("Error during completion: tool_use_failed")
    assert action is RetryAction.RETRY


def test_success_between_failures_resets_the_counter():
    """A successful completion between two failures means the next failure
    is a fresh sequence, not the second half of an earlier retry."""
    policy = CompletionRetryPolicy()
    policy.on_error("Error during completion: tool_use_failed")
    policy.on_success()
    action = policy.on_error("Error during completion: tool_use_failed")
    assert action is RetryAction.RETRY


def test_unrelated_error_is_ignored_and_does_not_affect_the_counter():
    policy = CompletionRetryPolicy()
    assert policy.on_error("Some unrelated network error") is RetryAction.IGNORE
    # The unrelated error must not have incremented the counter.
    assert policy.on_error("Error during completion: tool_use_failed") is RetryAction.RETRY
