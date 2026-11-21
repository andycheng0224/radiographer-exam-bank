#!/usr/bin/env python3
"""Read-only preflight for a built preview. Skip iCloud placeholders without hydrating them."""
import argparse
from collections import Counter
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import stat
from urllib.parse import unquote, urlsplit

DATALESS = 0x40000000
MAX_FILES = 20_000
MAX_SIZE = 25 * 1024 * 1024
IMAGE_MARKER = re.compile(r"\{\{image:([^}]+)\}\}")


class EntryAssets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == "script" and attrs.get("src"):
            self.urls.append(attrs["src"])
        if tag == "link" and attrs.get("rel") in {"stylesheet", "modulepreload"} and attrs.get("href"):
            self.urls.append(attrs["href"])


def local_url(raw):
    if not isinstance(raw, str) or not raw or "\\" in raw:
        raise ValueError("Invalid URL")
    parsed = urlsplit(raw)
    parts = unquote(parsed.path).removeprefix("/").split("/")
    if parsed.scheme or parsed.netloc or any(part in {"", ".", ".."} for part in parts):
        raise ValueError("Expected package-relative URL")
    return "/".join(parts)


def image_refs(question):
    def strings(value):
        if isinstance(value, str):
            yield value
        elif isinstance(value, dict):
            for item in value.values():
                yield from strings(item)
        elif isinstance(value, list):
            for item in value:
                yield from strings(item)

    for key in ("question", "questionText", "stem", "options", "explanation"):
        for text in strings(question.get(key)):
            yield from IMAGE_MARKER.findall(text)
    image = question.get("image")
    if image:
        yield image.get("src", "") if isinstance(image, dict) else image


def inspect_preview(root):
    root = Path(root)
    if root.is_symlink() or not root.is_dir():
        raise ValueError("Expected a real preview output directory")

    entries, counts, examples = {}, Counter(), {}

    def issue(code, path):
        counts[code] += 1
        if len(examples.setdefault(code, [])) < 8:
            examples[code].append(path)

    def walk_error(error):
        issue("inventory-read-error", str(error.filename))

    for directory, dirs, files in os.walk(root, onerror=walk_error):
        for name in [*dirs, *files]:
            file = Path(directory) / name
            relative = file.relative_to(root).as_posix()
            try:
                info = file.lstat()
            except OSError:
                issue("inventory-read-error", relative)
                continue
            if stat.S_ISLNK(info.st_mode):
                issue("symlink", relative)
            elif stat.S_ISREG(info.st_mode):
                entries[relative] = info
                if getattr(info, "st_flags", 0) & DATALESS:
                    issue("package-dataless", relative)
                if info.st_size > MAX_SIZE:
                    issue("file-too-large", relative)
    if len(entries) > MAX_FILES:
        issue("too-many-files", str(len(entries)))

    def available(path, kind):
        info = entries.get(path)
        reason = ("missing" if info is None else "dataless" if getattr(info, "st_flags", 0) & DATALESS
                  else "empty" if not info.st_size else None)
        if reason:
            issue(f"{kind}-{reason}", path)
        return None if reason else info

    def read(path, kind):
        info = available(path, kind)
        if not info:
            return None
        try:
            data = (root / path).read_bytes()
            if len(data) != info.st_size:
                issue(f"{kind}-short-read", path)
                return None
            return data.decode("utf-8")
        except (OSError, UnicodeError):
            issue(f"{kind}-read-error", path)
            return None

    def load_json(path):
        data = read(path, "catalog")
        if data is None:
            return None
        try:
            return json.loads(data)
        except ValueError:
            issue("catalog-invalid-json", path)
            return None

    html = read("index.html", "entry")
    if html is not None:
        parser = EntryAssets()
        parser.feed(html)
        if not parser.urls:
            issue("entry-no-assets", "index.html")
        for url in parser.urls:
            try:
                available(local_url(url), "entry-asset")
            except ValueError:
                issue("entry-asset-nonlocal", url)

    index = load_json("data/question-index.json")
    key_map = load_json("data/question-key-map.json")
    if not isinstance(index, list) or not index:
        issue("catalog-invalid-index", "data/question-index.json")
    if not isinstance(key_map, dict) or not key_map:
        issue("catalog-invalid-key-map", "data/question-key-map.json")

    shards, images, unavailable_shards = set(), set(), set()
    inspected_count = 0
    for record in index if isinstance(index, list) else []:
        try:
            shard = local_url(record.get("filePath"))
            if not shard.startswith("data/questions/") or not shard.endswith(".json") or shard in shards:
                raise ValueError("Invalid or duplicate shard")
        except (AttributeError, ValueError):
            issue("catalog-invalid-shard-path", str(record))
            continue
        shards.add(shard)
        questions = load_json(shard)
        if not isinstance(questions, list):
            unavailable_shards.add(shard)
            if questions is not None:
                issue("catalog-invalid-shard", shard)
            continue
        if len(questions) != record.get("questionCount"):
            issue("catalog-count-mismatch", shard)
        for question in questions:
            if not isinstance(question, dict):
                issue("catalog-invalid-question", shard)
                continue
            inspected_count += 1
            for raw in image_refs(question):
                if not isinstance(raw, str):
                    issue("image-invalid-path", shard)
                    continue
                normalized = raw.replace("\\", "/").strip()
                if normalized.startswith("data:"):
                    continue
                if normalized.startswith(("https://", "http://", "//")):
                    issue("image-nonlocal", normalized)
                    continue
                # Match QuestionContent: root uploads paths are preserved, legacy paths use basename.
                url = normalized if normalized.startswith("/uploads/") else "/uploads/" + normalized.split("/")[-1]
                try:
                    path = local_url(url)
                    if not path.startswith("uploads/"):
                        raise ValueError("Outside uploads")
                    images.add(path)
                except ValueError:
                    issue("image-invalid-path", normalized)
    if isinstance(key_map, dict):
        for url in {value for value in key_map.values() if isinstance(value, str)}:
            try:
                if local_url(url) not in shards:
                    raise ValueError("Not indexed")
            except ValueError:
                issue("catalog-unindexed-key-target", url)
        if any(not isinstance(value, str) for value in key_map.values()):
            issue("catalog-invalid-key-target", "data/question-key-map.json")
    for image in sorted(images):
        available(image, "referenced-image")

    largest = max(entries, key=lambda path: (entries[path].st_size, path), default=None)
    return {
        "passed": not counts, "files": len(entries),
        "largestAsset": {"path": largest, "bytes": entries[largest].st_size} if largest else None,
        "withinPagesFreeAssetLimits": len(entries) <= MAX_FILES and not counts["file-too-large"],
        "indexedShards": len(shards), "unavailableShards": sorted(unavailable_shards),
        "inspectedQuestions": inspected_count, "referencedImagesFromReadableShards": len(images),
        "issues": {key: value for key, value in counts.items() if value}, "examples": examples,
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output_dir", type=Path)
    args = parser.parse_args()
    try:
        result = inspect_preview(args.output_dir)
    except ValueError as error:
        parser.error(str(error))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["passed"] else 1)
