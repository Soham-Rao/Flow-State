import os
from collections import defaultdict

# Directories to ignore
IGNORE_DIRS = {
    "node_modules",
    "dist",
    "build",
    ".git",
    ".next",
    ".nuxt",
    "coverage",
    ".venv",
    "venv",
    "env",
    "__pycache__",
    ".cache",
    ".idea",
    ".vscode",
    "target",
    "out",
    "bin",
    "obj",
}

# Code file extensions
CODE_EXTENSIONS = {
    ".py", ".js", ".ts", ".jsx", ".tsx",
    ".java", ".c", ".cpp", ".h", ".hpp",
    ".cs", ".go", ".rs", ".rb", ".php",
    ".kt", ".kts", ".swift", ".scala",
    ".html", ".css", ".scss", ".sass",
    ".json", ".yaml", ".yml", ".xml",
    ".sh", ".bat", ".ps1", ".sql"
}

total_lines = 0
file_count = 0
lines_per_ext = defaultdict(int)

for root, dirs, files in os.walk("."):
    # Remove ignored directories
    dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

    for file in files:
        ext = os.path.splitext(file)[1].lower()

        if ext not in CODE_EXTENSIONS:
            continue

        path = os.path.join(root, file)

        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                lines = sum(1 for _ in f)

            total_lines += lines
            file_count += 1
            lines_per_ext[ext] += lines

        except Exception:
            # Skip unreadable files
            continue


print("\nProject Code Statistics")
print("-" * 30)
print(f"Files counted : {file_count}")
print(f"Total lines   : {total_lines}\n")

print("Lines by extension:")
print("-" * 30)

for ext, count in sorted(lines_per_ext.items(), key=lambda x: x[1], reverse=True):
    print(f"{ext:<8} {count}")

print("\nDone.")