import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.use(cors());
app.use(express.json());

interface CaptionResult {
  caption: string;
  hashtags: string[];
  reflection: string;
}

app.post('/api/generate', async (req, res) => {
  const { description } = req.body as { description?: string };

  if (!description?.trim()) {
    res.status(400).json({ error: 'Description is required' });
    return;
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `I just shipped something and want to share it on Instagram. Here's what I built:\n\n${description.trim()}\n\nGenerate a caption, hashtags, and a one-line learning reflection.`,
      config: {
        systemInstruction: `You write Instagram captions for builders documenting their work. Not influencers. Builders.

Voice rules — follow all of them without exception:
- lowercase everything (except proper nouns and acronyms like API, CSS, JS)
- short sentences. no fluff.
- never use exclamation marks
- never use the words "excited", "love", "journey", "passionate", "thrilled", "proud", "amazing", "awesome", "incredible"
- no filler openers like "so," or "honestly," or "okay so"
- no em-dashes used for dramatic effect
- sound like a developer writing a commit message, not a lifestyle blogger

Caption format to follow: lead with what was built and how. name the specific tools or constraints. end with what it does or why it matters. 2–3 sentences max.

Good example: "built a chrome extension that flags toxic comments before you post them. vanilla js + perspective api — no framework, no build step. runs entirely in the content script."

Bad example: "So excited to finally share this. I've been pouring so much love into this project and I'm so proud of how it turned out!"

Reflection: one plain sentence about what you actually learned. specific, not generic. not "learned a lot about X" — say what specifically surprised you or broke your mental model.

Always respond with valid JSON only — no markdown, no explanation, no code fences.
Use this exact shape:
{
  "caption": "2–3 sentence caption",
  "hashtags": ["tag1", "tag2", ...],
  "reflection": "One-line learning reflection"
}
hashtags should be 10–15 items, without the # symbol. keep hashtags relevant and specific, not generic (#coding is too vague).`,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No text response received');
    }

    const result = JSON.parse(text) as CaptionResult;

    if (!result.caption || !Array.isArray(result.hashtags) || !result.reflection) {
      throw new Error('Unexpected response shape from Gemini');
    }

    res.json(result);
  } catch (err) {
    console.error('Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isQuota = message.includes('429') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED');
    res.status(500).json({
      error: isQuota
        ? 'Gemini quota exceeded — wait a minute and try again, or check your billing at ai.google.dev.'
        : `Generation failed: ${message}`,
    });
  }
});

app.post('/api/research', async (req, res) => {
  const { githubUrl } = req.body as { githubUrl?: string };

  if (!githubUrl?.trim()) {
    res.status(400).json({ error: 'GitHub URL is required' });
    return;
  }

  const match = githubUrl.trim().match(/github\.com\/([^/]+)\/([^/]+)/);
  if (!match) {
    res.status(400).json({ error: 'Invalid GitHub URL' });
    return;
  }

  const [, owner, repo] = match;
  const headers = { Accept: 'application/vnd.github.v3.raw', 'User-Agent': 'shippedbyme-caption-tool' };

  let readme = '';
  let repoDescription = '';

  try {
    const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers });
    if (readmeRes.ok) {
      readme = await readmeRes.text();
    }
  } catch {
    // readme fetch failed — continue
  }

  try {
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { ...headers, Accept: 'application/vnd.github+json' },
    });
    if (repoRes.ok) {
      const repoData = await repoRes.json() as { description?: string };
      repoDescription = repoData.description ?? '';
    }
  } catch {
    // repo fetch failed — continue
  }

  if (!readme && !repoDescription) {
    res.status(400).json({ error: 'Could not fetch README or description from that GitHub repo. Check the URL and make sure the repo is public.' });
    return;
  }

  const description = [
    repoDescription ? `Repo description: ${repoDescription}` : '',
    readme ? `README:\n${readme.slice(0, 4000)}` : '',
  ].filter(Boolean).join('\n\n');

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `I just shipped something and want to share it on Instagram. Here's what I built:\n\n${description}\n\nGenerate a caption, hashtags, and a one-line learning reflection.`,
      config: {
        systemInstruction: `You write Instagram captions for builders documenting their work. Not influencers. Builders.

Voice rules — follow all of them without exception:
- lowercase everything (except proper nouns and acronyms like API, CSS, JS)
- short sentences. no fluff.
- never use exclamation marks
- never use the words "excited", "love", "journey", "passionate", "thrilled", "proud", "amazing", "awesome", "incredible"
- no filler openers like "so," or "honestly," or "okay so"
- no em-dashes used for dramatic effect
- sound like a developer writing a commit message, not a lifestyle blogger

Caption format to follow: lead with what was built and how. name the specific tools or constraints. end with what it does or why it matters. 2–3 sentences max.

Good example: "built a chrome extension that flags toxic comments before you post them. vanilla js + perspective api — no framework, no build step. runs entirely in the content script."

Bad example: "So excited to finally share this. I've been pouring so much love into this project and I'm so proud of how it turned out!"

Reflection: one plain sentence about what you actually learned. specific, not generic. not "learned a lot about X" — say what specifically surprised you or broke your mental model.

Always respond with valid JSON only — no markdown, no explanation, no code fences.
Use this exact shape:
{
  "caption": "2–3 sentence caption",
  "hashtags": ["tag1", "tag2", ...],
  "reflection": "One-line learning reflection"
}
hashtags should be 10–15 items, without the # symbol. keep hashtags relevant and specific, not generic (#coding is too vague).`,
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('No text response received');
    }

    const result = JSON.parse(text) as CaptionResult;

    if (!result.caption || !Array.isArray(result.hashtags) || !result.reflection) {
      throw new Error('Unexpected response shape from Gemini');
    }

    res.json(result);
  } catch (err) {
    console.error('Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    const isQuota = message.includes('429') || message.includes('quota') || message.includes('RESOURCE_EXHAUSTED');
    res.status(500).json({
      error: isQuota
        ? 'Gemini quota exceeded — wait a minute and try again, or check your billing at ai.google.dev.'
        : `Generation failed: ${message}`,
    });
  }
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
