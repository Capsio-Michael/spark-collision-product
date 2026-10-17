"""Optional server-side Kimi transport. Never exposes credentials to the browser."""
from __future__ import annotations

import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ALLOWED_BASE_URLS = {"https://api.moonshot.cn/v1", "https://api.moonshot.ai/v1"}


class ProviderError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code, self.message = code, message


class KimiProvider:
    def __init__(self, *, api_key, base_url, model, timeout=30, opener=urlopen):
        if base_url not in ALLOWED_BASE_URLS:
            raise ValueError("SPARK_KIMI_BASE_URL must be an exact supported regional URL")
        if not api_key or not model or len(model) > 100 or any(char.isspace() for char in model):
            raise ValueError("SPARK_KIMI_API_KEY and SPARK_KIMI_MODEL are required")
        self._key, self.base_url, self.model, self.timeout, self._opener = api_key, base_url, model, timeout, opener

    @classmethod
    def from_env(cls, env=None):
        env = env if env is not None else os.environ
        return cls(api_key=env.get("SPARK_KIMI_API_KEY", ""), base_url=env.get("SPARK_KIMI_BASE_URL", ""), model=env.get("SPARK_KIMI_MODEL", ""))

    def _request(self, messages, *, stream):
        body = {"model": self.model, "messages": messages, "stream": stream, "max_tokens": 4096}
        if self.model in ("kimi-k2.5", "kimi-k2.6"):
            body["thinking"] = {"type": "disabled"}
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        request = Request(f"{self.base_url}/chat/completions", data=payload, headers={
            "Authorization": f"Bearer {self._key}", "Content-Type": "application/json", "Accept": "text/event-stream" if stream else "application/json",
        }, method="POST")
        return self._open(request)

    def _open(self, request):
        try:
            return self._opener(request, timeout=self.timeout)
        except HTTPError as error:
            # Upstream messages can contain request content. Keep error text local and generic.
            raise ProviderError("UPSTREAM_HTTP_ERROR", f"Kimi 服务返回 HTTP {error.code}，请检查模型、额度或服务区域。") from None
        except (TimeoutError, URLError, OSError):
            raise ProviderError("UPSTREAM_NETWORK_ERROR", "Kimi 请求超时或网络暂时不可用。") from None

    def verify_model(self):
        """Check credentials and advertised model availability without generating tokens."""
        request = Request(f"{self.base_url}/models", headers={"Authorization": f"Bearer {self._key}", "Accept": "application/json"})
        try:
            with self._open(request) as response:
                value = json.loads(response.read(262144))
            items = value.get("data") if isinstance(value, dict) else None
            if not isinstance(items, list) or any(not isinstance(item, dict) or not isinstance(item.get("id"), str) for item in items):
                raise ProviderError("UPSTREAM_RESPONSE_INVALID", "Kimi 模型列表格式不正确，请稍后重试。")
            if self.model not in {item["id"] for item in items}:
                raise ProviderError("MODEL_NOT_AVAILABLE", "所选 Kimi 模型不在当前可用列表中，请核对 SPARK_KIMI_MODEL。")
        except (TimeoutError, URLError, OSError):
            raise ProviderError("UPSTREAM_NETWORK_ERROR", "Kimi 模型列表查询超时或网络暂时不可用。") from None
        except (ValueError, TypeError):
            raise ProviderError("UPSTREAM_RESPONSE_INVALID", "Kimi 模型列表格式不正确，请稍后重试。") from None

    def complete(self, messages):
        try:
            with self._request(messages, stream=False) as response:
                data = json.loads(response.read(262144))
                choice = data["choices"][0]
                content = choice["message"]["content"]
                if choice.get("finish_reason") not in (None, "stop"):
                    raise ProviderError("UPSTREAM_INCOMPLETE", "Kimi 回复未完整结束，请缩短材料后重试。")
        except (TimeoutError, URLError, OSError):
            raise ProviderError("UPSTREAM_NETWORK_ERROR", "Kimi 请求超时或网络暂时不可用。") from None
        except (ValueError, KeyError, IndexError, TypeError):
            raise ProviderError("UPSTREAM_RESPONSE_INVALID", "Kimi 返回内容格式不正确。") from None
        if not isinstance(content, str) or not content.strip() or len(content) > 40000:
            raise ProviderError("UPSTREAM_EMPTY_RESULT", "Kimi 未返回可用的文字结果。")
        return content

    def stream(self, messages):
        try:
            with self._request(messages, stream=True) as response:
                total = 0
                finished = False
                for raw in response:
                    if len(raw) > 65536:
                        raise ProviderError("UPSTREAM_RESPONSE_INVALID", "Kimi 流片段过大。")
                    line = raw.decode("utf-8", errors="replace").strip()
                    if not line.startswith("data:"):
                        continue
                    value = line[5:].strip()
                    if value == "[DONE]":
                        finished = True
                        break
                    try:
                        data = json.loads(value)
                        choices = data.get("choices") or []
                        if choices and choices[0].get("finish_reason") not in (None, "stop"):
                            raise ProviderError("UPSTREAM_INCOMPLETE", "Kimi 回复未完整结束，请重试。")
                        part = choices[0].get("delta", {}).get("content") if choices else None
                    except (ValueError, KeyError, IndexError, TypeError, AttributeError):
                        raise ProviderError("UPSTREAM_RESPONSE_INVALID", "Kimi 流片段格式不正确。") from None
                    if part is None:
                        continue
                    if not isinstance(part, str):
                        raise ProviderError("UPSTREAM_RESPONSE_INVALID", "Kimi 流片段不是文字。")
                    total += len(part)
                    if total > 12000:
                        raise ProviderError("UPSTREAM_RESPONSE_LIMIT", "本次回复超过长度上限。")
                    if part:
                        yield part
                if total == 0:
                    raise ProviderError("UPSTREAM_EMPTY_RESULT", "Kimi 未返回可用的文字结果。")
                if not finished:
                    raise ProviderError("UPSTREAM_INCOMPLETE", "Kimi 连接中断，回复未完成。")
        except (TimeoutError, URLError, OSError):
            raise ProviderError("UPSTREAM_NETWORK_ERROR", "Kimi 请求超时或网络暂时不可用。") from None
