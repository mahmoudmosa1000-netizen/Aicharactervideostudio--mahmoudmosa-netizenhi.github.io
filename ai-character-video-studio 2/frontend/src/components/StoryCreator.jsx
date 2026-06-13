// ─── components/StoryCreator.jsx ─────────────────────────────────────────────
import { useState } from "react";
import "./StoryCreator.css";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { TextInput, TextArea, Select } from "./ui/Input";
import { storyApi } from "../lib/api";
import { SCENE_COLORS } from "../lib/constants";

export default function StoryCreator({ chars }) {
  const [charId, setCharId]     = useState(String(chars[0]?.id || 1));
  const [idea, setIdea]         = useState("");
  const [scenes, setScenes]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [apiError, setApiError] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);

  const selectedChar = chars.find((c) => c.id === Number(charId)) || chars[0];

  const generateStory = async () => {
    if (!idea || !selectedChar) return;
    setLoading(true); setApiError(null); setScenes([]);
    try {
      const result = await storyApi.generate(selectedChar, idea);
      setScenes(result);
    } catch {
      setApiError("Story generation failed. Please check your API key and try again.");
    }
    setLoading(false);
  };

  const updateScene = (idx, field, val) =>
    setScenes((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: val } : s)));

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Story Creator</h1>
          <p className="page-subtitle">One idea → five connected scenes, same character throughout</p>
        </div>
      </div>

      {/* Input Bar */}
      <Card className="story-input-bar">
        <div className="story-input-bar__grid">
          <Select label="Character" value={charId} onChange={setCharId}
            options={chars.map((c) => ({ value: String(c.id), label: `${c.name}${c.locked ? " 🔒" : ""}` }))} />
          <TextInput label="Story Idea" value={idea} onChange={setIdea}
            placeholder='"Mochi opens a bakery and befriends the whole neighbourhood" — one line is enough' />
          <Button variant="primary" size="lg" onClick={generateStory} disabled={loading || !idea} className="story-input-bar__btn">
            {loading ? "⟳ Generating…" : "◇ Create Story"}
          </Button>
        </div>
      </Card>

      {apiError && <div className="error-box">{apiError}</div>}

      {/* Skeleton Loader */}
      {loading && (
        <div className="story-skeletons">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className={`skeleton story-skeleton delay-${i}`} style={{ height: 96 }} />
          ))}
        </div>
      )}

      {/* Scene List */}
      {scenes.length > 0 && (
        <>
          <div className="story-list-header">
            <div className="story-list-title">
              Story: <span>"{idea}"</span>
            </div>
            <div className="story-list-actions">
              <Button size="sm">⬇ Export Prompts</Button>
              <Button size="sm" variant="primary">▶ Generate All 5 Videos</Button>
            </div>
          </div>

          <div className="story-scenes">
            {scenes.map((s, i) => (
              <Card key={i} className="scene-card">
                {/* Number + connector */}
                <div className="scene-card__number-col">
                  <div className="scene-card__number" style={{ color: SCENE_COLORS[i], background: `${SCENE_COLORS[i]}18`, border: `1px solid ${SCENE_COLORS[i]}33` }}>
                    {s.scene}
                  </div>
                  {i < scenes.length - 1 && <div className="scene-card__connector" />}
                </div>

                {/* Content */}
                <div className="scene-card__content">
                  {editingIdx === i ? (
                    <div className="scene-card__edit">
                      <TextInput value={s.title} onChange={(v) => updateScene(i, "title", v)} />
                      <TextArea value={s.description} onChange={(v) => updateScene(i, "description", v)} rows={3} />
                      <Button size="sm" onClick={() => setEditingIdx(null)}>✓ Done</Button>
                    </div>
                  ) : (
                    <>
                      <div className="scene-card__title">{s.title}</div>
                      <div className="scene-card__desc">{s.description}</div>
                      <div className="scene-card__tags">
                        <span className="scene-card__tag scene-card__tag--gray">📷 {s.camera}</span>
                        <span className="scene-card__tag" style={{ color: SCENE_COLORS[i], background: `${SCENE_COLORS[i]}12` }}>✦ {s.mood}</span>
                        <span className="scene-card__tag scene-card__tag--gray">⏱ {s.duration}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Actions */}
                <div className="scene-card__actions">
                  <Button variant="primary" size="sm">▶ Generate</Button>
                  <Button size="sm" onClick={() => setEditingIdx(editingIdx === i ? null : i)}>✎ Edit</Button>
                </div>
              </Card>
            ))}
          </div>

          {/* Consistency Banner */}
          <div className="consistency-banner">
            <span>🔒</span>
            <div>
              <div className="consistency-banner__title">Character Consistency Active</div>
              <div className="consistency-banner__body">
                {selectedChar?.name}'s full visual profile is embedded into every scene prompt — same face, clothing, and style across all 5 videos.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
