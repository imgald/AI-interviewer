export type SupportedEditorLanguage = "PYTHON" | "JAVASCRIPT" | "JAVA" | "C++";

export function getStarterCode(language: string | null | undefined, questionTitle: string) {
  switch (normalizeLanguage(language)) {
    case "JAVASCRIPT":
      return `function solve(input) {
  // ${questionTitle}
  return input;
}

const sampleInput = [];
console.log(JSON.stringify(solve(sampleInput)));`;
    case "JAVA":
      return `import java.util.*;

public class Main {
  public static Object solve(Object input) {
    // ${questionTitle}
    return input;
  }

  public static void main(String[] args) {
    Object sampleInput = new ArrayList<>();
    System.out.println(solve(sampleInput));
  }
}`;
    case "C++":
      return `#include <iostream>
#include <vector>
using namespace std;

vector<int> solve(vector<int> input) {
  // ${questionTitle}
  return input;
}

int main() {
  vector<int> sampleInput{};
  auto result = solve(sampleInput);
  cout << result.size() << endl;
  return 0;
}`;
    case "PYTHON":
    default:
      return `def solve(input):
    # ${questionTitle}
    return input

if __name__ == "__main__":
    sample_input = []
    print(solve(sample_input))`;
  }
}

export function toMonacoLanguage(language: string | null | undefined) {
  switch (normalizeLanguage(language)) {
    case "JAVASCRIPT":
      return "javascript";
    case "JAVA":
      return "java";
    case "C++":
      return "cpp";
    case "PYTHON":
    default:
      return "python";
  }
}

export function normalizeLanguage(language: string | null | undefined): SupportedEditorLanguage {
  const normalized = (language ?? "PYTHON").trim().toUpperCase();
  if (normalized === "JAVASCRIPT") return "JAVASCRIPT";
  if (normalized === "JAVA") return "JAVA";
  if (normalized === "C++" || normalized === "CPP") return "C++";
  return "PYTHON";
}

export function isRunnableLanguage(language: string | null | undefined) {
  const normalized = normalizeLanguage(language);
  return normalized === "PYTHON" || normalized === "JAVASCRIPT";
}
