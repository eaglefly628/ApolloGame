// 对手卡降级链点名测试（规范 §12「scope 缺失场景有测试和降级行为」的单元半程；
// 三形态整链目击在 scripts/host-witness.mjs——假宿主 createAppHost 真跑 dist）。
import test from "node:test";
import assert from "node:assert/strict";
import { hasScope, characterToDraft, pickFoeSource } from "../src/foe-card.mjs";

test("hasScope：零授权（undefined/[]）一律 false，命中才 true", () => {
  assert.equal(hasScope(undefined, "character.identity"), false);
  assert.equal(hasScope([], "character.identity"), false);
  assert.equal(hasScope(["character.avatar"], "character.identity"), false);
  assert.equal(hasScope(["character.identity", "character.avatar"], "character.identity"), true);
});

test("characterToDraft：PublicCharacter 键名搬运——portraitUrl 落 imageUrl 位·avatarUrl 原位", () => {
  const draft = characterToDraft({
    id: "c1", name: "雪莉", description: "冷面甜心",
    avatarUrl: "https://cdn/ava.png", portraitUrl: "https://cdn/full.png", tags: ["cool"],
  });
  assert.deepEqual(draft, {
    id: "c1", name: "雪莉", description: "冷面甜心",
    avatarUrl: "https://cdn/ava.png", imageUrl: "https://cdn/full.png",   // 锚点：portraitUrl→imageUrl
  });
});

test("characterToDraft：缺媒体键不造键（桥的「没图退首字」语义靠键真缺席）·非法输入 null", () => {
  const draft = characterToDraft({ id: "c2", name: "阿岚" });
  assert.deepEqual(draft, { id: "c2", name: "阿岚" });
  assert.ok(!("avatarUrl" in draft) && !("imageUrl" in draft));
  assert.equal(characterToDraft(null), null);
  assert.equal(characterToDraft("字符串"), null);
});

test("pickFoeSource：降级链三级各落各位（character > input > default）", () => {
  const character = { id: "c1", name: "雪莉" };
  const inputCard = { name: "茶茶" };
  assert.equal(pickFoeSource({ character, inputCard }), "character");   // 锚点：资料压过 input 卡
  assert.equal(pickFoeSource({ character: null, inputCard }), "input");
  assert.equal(pickFoeSource({ character: null, inputCard: undefined }), "default");
  assert.equal(pickFoeSource({}), "default");
});
