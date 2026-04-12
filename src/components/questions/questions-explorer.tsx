"use client";

import { useMemo, useState } from "react";
import { QuestionLaunchButton } from "@/components/questions/question-launch-button";

export type QuestionExplorerItem = {
  id: string;
  order: number | null;
  title: string;
  type: "CODING" | "SYSTEM_DESIGN";
  difficulty: "EASY" | "MEDIUM" | "HARD";
  levelTarget: "NEW_GRAD" | "SDE1" | "SDE2" | "SENIOR" | "STAFF" | "N/A";
  companyStyle: "GENERIC" | "AMAZON" | "META" | "GOOGLE" | "STRIPE";
  estimatedMinutes: number | null;
  topicTags: string[];
};

type MatchMode = "all" | "any";
type FilterKey = "difficulty" | "company" | "tag";
type TopicScope = "__ALL__" | "CODING" | "SYSTEM_DESIGN";

type FilterState = {
  difficulty: Set<string>;
  company: Set<string>;
  tag: Set<string>;
};

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  boxShadow: "var(--shadow)",
} as const;

function asSorted(values: Iterable<string>) {
  return Array.from(values).sort((left, right) => left.localeCompare(right));
}

function isAlgorithmTag(tag: string) {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  if (normalized.startsWith("company:")) {
    return false;
  }
  if (normalized.endsWith("-high-frequency")) {
    return false;
  }
  return true;
}

function toggleInSet(current: Set<string>, value: string) {
  const next = new Set(current);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

export function QuestionsExplorer({ questions }: { questions: QuestionExplorerItem[] }) {
  const [searchText, setSearchText] = useState("");
  const [showPanel, setShowPanel] = useState(false);
  const [matchMode, setMatchMode] = useState<MatchMode>("all");
  const [topicScope, setTopicScope] = useState<TopicScope>("__ALL__");
  const [filters, setFilters] = useState<FilterState>({
    difficulty: new Set(),
    company: new Set(),
    tag: new Set(),
  });

  const options = useMemo(() => {
    const algorithmTags = asSorted(
      new Set(questions.flatMap((question) => question.topicTags).filter(isAlgorithmTag)),
    );
    return {
      difficulty: asSorted(new Set(questions.map((question) => question.difficulty))),
      company: asSorted(new Set(questions.map((question) => question.companyStyle))),
      tag: algorithmTags,
    };
  }, [questions]);

  const activeFilterCount = useMemo(() => {
    return (
      filters.difficulty.size +
      filters.company.size +
      filters.tag.size
    );
  }, [filters]);

  const filtered = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    const groupMatchers: Array<(question: QuestionExplorerItem) => boolean> = [];
    if (filters.difficulty.size > 0) {
      groupMatchers.push((question) => filters.difficulty.has(question.difficulty));
    }
    if (filters.company.size > 0) {
      groupMatchers.push((question) => filters.company.has(question.companyStyle));
    }
    if (filters.tag.size > 0) {
      groupMatchers.push((question) => question.topicTags.some((tag) => filters.tag.has(tag)));
    }

    return questions.filter((question) => {
      if (topicScope !== "__ALL__" && question.type !== topicScope) {
        return false;
      }

      if (normalizedSearch) {
        const corpus = `${question.title} ${question.type} ${question.difficulty} ${question.levelTarget} ${question.companyStyle} ${question.topicTags.join(" ")}`.toLowerCase();
        if (!corpus.includes(normalizedSearch)) {
          return false;
        }
      }

      if (groupMatchers.length === 0) {
        return true;
      }

      if (matchMode === "all") {
        return groupMatchers.every((matcher) => matcher(question));
      }

      return groupMatchers.some((matcher) => matcher(question));
    });
  }, [filters, matchMode, questions, searchText, topicScope]);

  function toggleFilter(key: FilterKey, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: toggleInSet(current[key], value),
    }));
  }

  function clearAllFilters() {
    setFilters({
      difficulty: new Set(),
      company: new Set(),
      tag: new Set(),
    });
    setSearchText("");
    setMatchMode("all");
  }

  return (
    <div style={{ width: "min(1440px, 100%)", margin: "0 auto", display: "grid", gap: 18 }}>
      <section
        style={{
          ...cardStyle,
          padding: 18,
          background:
            "radial-gradient(circle at 10% 10%, rgba(33,70,145,0.16), transparent 34%), linear-gradient(180deg, #1a1d24 0%, #111318 100%)",
          color: "#e6e9ef",
        }}
      >
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {[
              { id: "__ALL__" as const, label: "All Topics" },
              { id: "CODING" as const, label: "Algorithms" },
              { id: "SYSTEM_DESIGN" as const, label: "System Design" },
            ].map((topic) => {
              const active = topicScope === topic.id;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setTopicScope(topic.id)}
                  style={{
                    border: active ? "1px solid transparent" : "1px solid rgba(255,255,255,0.14)",
                    borderRadius: 999,
                    padding: "10px 16px",
                    background: active ? "#f4f6fa" : "rgba(255,255,255,0.08)",
                    color: active ? "#181b24" : "#e6e9ef",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontWeight: 700,
                  }}
                >
                  {topic.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search Questions"
              style={{
                flex: "1 1 320px",
                minWidth: 280,
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.14)",
                background: "rgba(255,255,255,0.07)",
                color: "#e6e9ef",
                padding: "12px 16px",
                fontSize: 16,
              }}
            />
            <button
              type="button"
              onClick={() => setShowPanel((current) => !current)}
              style={{
                border: "1px solid rgba(99,178,255,0.45)",
                borderRadius: 999,
                padding: "10px 12px",
                background: showPanel ? "rgba(99,178,255,0.2)" : "rgba(99,178,255,0.08)",
                color: "#8fc9ff",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span aria-hidden="true">[F]</span>
              <span>Filter</span>
              {activeFilterCount > 0 ? (
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: 999,
                    background: "#2196f3",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    padding: "0 6px",
                  }}
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
            <div style={{ color: "#c8d1df", fontSize: 15 }}>
              {filtered.length} / {questions.length} questions
            </div>
          </div>

          {showPanel ? (
            <div
              style={{
                marginTop: 6,
                borderRadius: 18,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                padding: 16,
                display: "grid",
                gap: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontWeight: 700 }}>Match</span>
                <select
                  value={matchMode}
                  onChange={(event) => setMatchMode(event.target.value as MatchMode)}
                  style={panelSelectStyle}
                >
                  <option value="all">All</option>
                  <option value="any">Any</option>
                </select>
                <span style={{ color: "#c8d1df" }}>of the following filters:</span>
                <button type="button" onClick={clearAllFilters} style={clearButtonStyle}>
                  Clear All
                </button>
              </div>

              <FilterRow
                label="Difficulty"
                options={options.difficulty}
                selected={filters.difficulty}
                onToggle={(value) => toggleFilter("difficulty", value)}
              />
              <FilterRow
                label="Company"
                options={options.company}
                selected={filters.company}
                onToggle={(value) => toggleFilter("company", value)}
              />
              <FilterRow
                label="Algorithm Tag"
                options={options.tag}
                selected={filters.tag}
                onToggle={(value) => toggleFilter("tag", value)}
              />
            </div>
          ) : null}
        </div>
      </section>

      <section style={{ ...cardStyle, padding: 10, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1080 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid var(--border)" }}>
              <th style={{ padding: "12px 10px" }}>Title</th>
              <th style={{ padding: "12px 10px" }}>Difficulty</th>
              <th style={{ padding: "12px 10px" }}>Type</th>
              <th style={{ padding: "12px 10px" }}>Level</th>
              <th style={{ padding: "12px 10px" }}>Company</th>
              <th style={{ padding: "12px 10px" }}>Estimated</th>
              <th style={{ padding: "12px 10px" }}>Tags</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((question) => (
              <tr key={question.id} style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", verticalAlign: "top" }}>
                <td style={{ padding: "14px 10px", fontWeight: 700, minWidth: 300 }}>
                  <QuestionLaunchButton
                    questionId={question.id}
                    mode={question.type}
                    targetLevel={question.levelTarget === "N/A" ? undefined : question.levelTarget}
                    companyStyle={question.companyStyle}
                    variant="link"
                    label={question.order ? `${question.order}. ${question.title}` : question.title}
                  />
                </td>
                <td style={{ padding: "14px 10px" }}>
                  <span style={difficultyPill(question.difficulty)}>{question.difficulty}</span>
                </td>
                <td style={{ padding: "14px 10px" }}>{question.type}</td>
                <td style={{ padding: "14px 10px" }}>{question.levelTarget}</td>
                <td style={{ padding: "14px 10px" }}>{question.companyStyle}</td>
                <td style={{ padding: "14px 10px" }}>
                  {question.estimatedMinutes ? `${question.estimatedMinutes} min` : "-"}
                </td>
                <td style={{ padding: "14px 10px" }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {question.topicTags.length > 0 ? (
                      question.topicTags.map((tag) => (
                        <span
                          key={`${question.id}-${tag}`}
                          style={{
                            padding: "3px 9px",
                            borderRadius: 999,
                            border: "1px solid var(--border)",
                            background: "var(--surface-alt)",
                            color: "var(--muted)",
                            fontSize: 12,
                          }}
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <span style={{ color: "var(--muted)" }}>-</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function FilterRow({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: Set<string>;
  onToggle: (value: string) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <strong>{label}</strong>
        <span style={{ color: "#c8d1df", fontSize: 13 }}>{selected.size} selected</span>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {options.map((option) => {
          const active = selected.has(option);
          return (
            <button
              key={`${label}-${option}`}
              type="button"
              onClick={() => onToggle(option)}
              style={{
                border: active ? "1px solid #7dc2ff" : "1px solid rgba(255,255,255,0.16)",
                borderRadius: 999,
                padding: "6px 11px",
                background: active ? "rgba(125,194,255,0.2)" : "rgba(255,255,255,0.06)",
                color: active ? "#bfe4ff" : "#e6e9ef",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const panelSelectStyle = {
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 10,
  padding: "6px 10px",
  background: "rgba(255,255,255,0.06)",
  color: "#e6e9ef",
  font: "inherit",
} as const;

const clearButtonStyle = {
  marginLeft: "auto",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: 10,
  padding: "6px 10px",
  background: "rgba(255,255,255,0.08)",
  color: "#e6e9ef",
  cursor: "pointer",
  fontWeight: 700,
} as const;

function difficultyPill(difficulty: "EASY" | "MEDIUM" | "HARD") {
  if (difficulty === "EASY") {
    return {
      padding: "4px 10px",
      borderRadius: 999,
      background: "rgba(20,156,92,0.14)",
      color: "#0f8e57",
      fontWeight: 700,
      fontSize: 12,
    } as const;
  }

  if (difficulty === "HARD") {
    return {
      padding: "4px 10px",
      borderRadius: 999,
      background: "rgba(210,40,58,0.14)",
      color: "#cc2840",
      fontWeight: 700,
      fontSize: 12,
    } as const;
  }

  return {
    padding: "4px 10px",
    borderRadius: 999,
    background: "rgba(212,148,24,0.16)",
    color: "#a56d00",
    fontWeight: 700,
    fontSize: 12,
  } as const;
}

