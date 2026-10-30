"""Thin API clients for GitHub, Slack and Claude."""
import os

import requests


class GitHub:
    def __init__(self, repo, token=None):
        self.base = f"https://api.github.com/repos/{repo}"
        self.headers = {"Authorization": f"Bearer {token or os.environ['GITHUB_TOKEN']}",
                        "Accept": "application/vnd.github+json"}

    def __call__(self, method, path, **kw):
        r = requests.request(method, self.base + path, headers=self.headers, timeout=30, **kw)
        if method == "DELETE" and r.status_code == 404:
            return None
        r.raise_for_status()
        return r.json() if r.content else None


class Slack:
    def __init__(self, token=None):
        self.headers = {"Authorization": f"Bearer {(token or os.environ['SLACK_BOT_TOKEN']).strip()}"}

    def __call__(self, method, **params):
        r = requests.post(f"https://slack.com/api/{method}", headers=self.headers, data=params, timeout=30)
        r.raise_for_status()
        data = r.json()
        if not data.get("ok"):
            raise RuntimeError(f"Slack {method} failed: {data.get('error')}")
        return data


class Claude:
    """Runs one step of an agent: system prompt from the agent, answer through the skill's tool."""

    def __init__(self, model, max_tokens, reminder, retry):
        self.model, self.max_tokens = model, max_tokens
        self.reminder, self.retry = reminder, retry

    def __call__(self, system, task, tool):
        import anthropic
        client = anthropic.Anthropic()
        messages = [{"role": "user", "content": task + "\n\n" + self.reminder.format(tool=tool["name"])}]
        # Forced tool_choice isn't supported by every model: ask for the tool call, retry once.
        for _ in range(2):
            msg = client.messages.create(model=self.model, max_tokens=self.max_tokens, system=system,
                                         tools=[tool], tool_choice={"type": "auto"}, messages=messages)
            for block in msg.content:
                if block.type == "tool_use" and block.name == tool["name"]:
                    return block.input
            messages += [{"role": "assistant", "content": msg.content},
                         {"role": "user", "content": self.retry.format(tool=tool["name"])}]
        raise RuntimeError(f"Claude did not call {tool['name']}")
