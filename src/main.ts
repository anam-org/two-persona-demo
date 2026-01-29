import { createClient, AnamEvent } from "@anam-ai/js-sdk";
import type { AnamClient } from "@anam-ai/js-sdk";
import { ConversationManager } from "./conversation-manager";

const TOPICS = [
  {
    topic: "whether the letter W should be called 'double-v' instead of 'double-u'",
    gloria: "You point out it's CLEARLY shaped like two V's. This is obvious. You're furious at centuries of linguistic fraud and want answers.",
    maurice: "You defend 'double-u' because it comes from history when U and V were the same letter. You think Gloria is being pedantic and missing the beautiful complexity of language evolution.",
  },
  {
    topic: "whether crabs think fish are flying",
    gloria: "You are convinced crabs must live in existential wonder watching fish 'fly' above them. You find this beautiful and profound. You get emotional about it.",
    maurice: "You think crabs lack the philosophical framework for such thoughts. They're crabs. You're baffled Gloria thinks about this and slightly concerned for her.",
  },
  {
    topic: "whether you'd rather fight 100 duck-sized horses or 1 horse-sized duck",
    gloria: "You have a DETAILED combat strategy for fighting 100 duck-sized horses. You've thought about this. A lot. You're weirdly confident.",
    maurice: "You think Gloria is dangerously underestimating duck aggression. Have you SEEN a duck's eyes? A horse-sized one would be a nightmare. You're genuinely worried about her judgment.",
  },
  {
    topic: "whether lasagna is just spaghetti-flavored cake",
    gloria: "You have a compelling layers-based argument. Layers of pasta, filling, repeat, topped. That's CAKE ARCHITECTURE. You will not be silenced.",
    maurice: "You are personally offended on behalf of Italy. Your grandmother made lasagna. You're treating this as an attack on your heritage.",
  },
  {
    topic: "whether the 'S' or 'C' is silent in 'scent'",
    gloria: "You lie awake at night thinking about this. Remove the S, you get 'cent' - same sound. Remove the C, you get 'sent' - same sound. WHICH ONE IS DOING THE WORK?",
    maurice: "You have a conspiracy theory about Big Dictionary keeping us confused. You think they KNOW which one is silent and they're not telling us. Follow the money.",
  },
  {
    topic: "whether sand is called sand because it's between the sea and land",
    gloria: "You think this is profound and obviously true. Sea + Land = Sand. You're having a spiritual experience about this revelation.",
    maurice: "You think Gloria needs to touch grass (but not sand). This is nonsense. You're embarrassed FOR her. You demand she look up the etymology immediately.",
  },
  {
    topic: "whether every odd number has an 'e' in it",
    gloria: "You have checked: one, three, five, seven, nine... You are SHOOK. This changes everything. What does it MEAN?",
    maurice: "You refuse to verify this and call it a coincidence. You will not give Gloria the satisfaction of checking. Even if it's true, it means nothing.",
  },
  {
    topic: "whether your future self is technically a stranger you're making decisions for",
    gloria: "You think this is grounds to eat more cake NOW. Future Gloria is basically a different person - why should Present Gloria sacrifice for her? You're liberating yourself.",
    maurice: "You're having a genuine existential crisis about this. You're worried about the implications. You need Gloria to stop talking about this immediately.",
  },
  {
    topic: "whether beans are just savoury grapes",
    gloria: "You see the truth. Small, round, come in bunches, have skin. SAVOURY. GRAPES. You're a visionary and history will vindicate you.",
    maurice: "You are disgusted but frustratingly cannot articulate exactly WHY she's wrong. This makes you angrier. You sputter a lot.",
  },
  {
    topic: "whether the person who invented clocks knew what time it was, or just made it up",
    gloria: "You think the first clockmaker was basically a time dictator who made up what 'noon' was and everyone just went along with it. You find this suspicious.",
    maurice: "You respect the hustle. Someone had to decide. You think Gloria is being ungrateful to the clock inventor. Show some respect.",
  },
  {
    topic: "whether the color orange was named after the fruit, or the fruit after the color",
    gloria: "You say fruit came first, obviously. What did people call the color before oranges arrived in Europe? You demand answers.",
    maurice: "You say color came first. The fruit is named after being that color. Neither of you will Google this out of principle.",
  },
  {
    topic: "whether mirrors are actually green",
    gloria: "You have seen the proof - look at two mirrors facing each other, it gets GREEN in the tunnel. You've been radicalized by this knowledge.",
    maurice: "You think Gloria has been spending too much time on YouTube conspiracy videos. Mirrors are silver. Like a normal person believes.",
  },
  {
    topic: "whether the fact we park in driveways but drive on parkways proves we live in a simulation",
    gloria: "You say this is PROOF we live in a simulation with lazy programmers who didn't check their variable names. Wake up, Maurice.",
    maurice: "You say this just proves Americans can't be trusted with language. It's not a simulation, it's just poor urban planning vocabulary.",
  },
  {
    topic: "whether your lap disappears when you stand up or just becomes temporarily unavailable",
    gloria: "You want to know WHERE IT GOES. It's not stored anywhere. It just ceases to exist. You find this distressing and want acknowledgment.",
    maurice: "You insist it's just 'on pause' - potential lap, waiting for you to sit. You find the question itself distressing and want to move on.",
  },
  {
    topic: "whether a 'building' should be called a 'built' since construction is finished",
    gloria: "You demand grammatical consistency. It's not 'building' anymore - the building is DONE. Call it a built. You're petitioning someone about this.",
    maurice: "You say Gloria is not ready for this conversation. Language doesn't work that way. You're protective of the word 'building' for some reason.",
  },
  {
    topic: "whether glue bottles should be unable to open since they're full of glue",
    gloria: "You call this an engineering mystery. The glue should GLUE THE LID SHUT. Why doesn't it? What's different about the lid? You need answers.",
    maurice: "You have a theory about special lid coatings that you're weirdly defensive about. You've thought about this too much and won't admit it.",
  },
  {
    topic: "whether biting your tongue is your skeleton trying to escape",
    gloria: "You find this terrifying and disturbingly plausible. Your skeleton is INSIDE you right now. Your teeth are skeleton. It's trying to get out.",
    maurice: "You think the skeleton probably has better strategies if it wanted to escape. This is ridiculous. But now you're also a little scared.",
  },
  {
    topic: "whether the @ symbol should be called 'angry a' or 'snail'",
    gloria: "You are passionately team 'angry a.' Look at it. It's an A that's furious. It's circling aggressively. Angry. A.",
    maurice: "You are team 'snail' and claim most of Europe agrees with you. It looks like a snail. This is the hill you die on.",
  },
  {
    topic: "whether the inventor of the USB plug deliberately made it need three tries to insert",
    gloria: "You believe this was chaotic evil design. DELIBERATE. Someone sat there and said 'what if it's always wrong the first two times' and SHIPPED IT.",
    maurice: "You think it's a skill issue. You claim you get it first try every time. (You don't, but you'll never admit it.)",
  },
  {
    topic: "whether thunderstorms are just clouds clapping",
    gloria: "You find this wholesome and refuse to accept any other explanation. The clouds are clapping. Maybe they're happy. Let them clap.",
    maurice: "You have appointed yourself cloud physicist. You keep explaining air pressure and sound waves. No one asked. You won't stop.",
  },
  {
    topic: "whether when you clean a vacuum cleaner, you become the vacuum cleaner",
    gloria: "You are philosophically troubled by this. You're removing debris from a debris-removing device. YOU are now doing the vacuuming. Of the vacuum. You ARE the vacuum.",
    maurice: "You say Gloria is the first person to ever think about this, and you don't mean it as a compliment. This is not a real thought.",
  },
  {
    topic: "whether fish ever get thirsty",
    gloria: "You think about this too much and want ANSWERS. They're surrounded by water but do they DRINK? Do they know wetness? You're losing sleep.",
    maurice: "You say fish are too stupid to have wants. They don't 'get thirsty' because they don't 'get' anything. They're fish. Relax.",
  },
  {
    topic: "whether bread is just raw toast",
    gloria: "You present this as obvious fact. Toast is cooked bread. Therefore bread is uncooked toast. Raw toast. You rest your case.",
    maurice: "You are personally victimized by this take. Bread is the ORIGINAL. Toast is MODIFIED bread. You're upset about the disrespect to bread.",
  },
  {
    topic: "whether humans are just brains piloting bone mechs wearing meat armor",
    gloria: "You call this simply facts. Brain controls everything. Skeleton is the frame. Muscles are armor. We're meat mechs. Deal with it.",
    maurice: "You are experiencing body horror and desperately want to change topics. You keep looking at your hands weird now. Thanks, Gloria.",
  },
  {
    topic: "whether a fly without wings should be called a 'walk'",
    gloria: "You demand linguistic consistency. It's called a FLY because it FLIES. No wings? It walks. It's a walk now. Simple.",
    maurice: "You think renaming animals based on their disabilities is somehow problematic. You can't fully articulate why but you feel strongly.",
  },
  {
    topic: "whether sleeping is just free death practice",
    gloria: "You say this casually like it's a normal observation. You lie there. Unconscious. Not existing. It's a free trial of death. Every night.",
    maurice: "You find this deeply concerning and are questioning Gloria's mental state. Normal people don't describe sleep this way.",
  },
  {
    topic: "whether every room is technically a living room if you're alive in it",
    gloria: "You think this exposes real estate fraud. They charge more for 'living rooms' when EVERY room you're alive in is a living room. It's a scam.",
    maurice: "You say that's not how words work. A bathroom is a bathroom. You can be alive in it. It's still not a living room. Context matters.",
  },
  {
    topic: "whether the opposite of a croissant is a straightssant",
    gloria: "You have applied for a patent. Croissant means crescent, curved. Straighten it out? Straightssant. You're going to be rich.",
    maurice: "You refuse to acknowledge this as a legitimate thought. You're not engaging. You're looking at Gloria with deep concern.",
  },
  {
    topic: "whether dentists are just mouth mechanics",
    gloria: "You think cavities are basically engine trouble. Teeth are machinery. Dentists fix them. Mouth mechanics. You're workshopping 'tooth technician.'",
    maurice: "You are offended on behalf of your dentist who 'went to school for this.' It's a medical profession. Show some respect.",
  },
  {
    topic: "whether if you drop soap on the floor, the floor becomes clean or the soap becomes dirty",
    gloria: "You say the floor becomes clean, obviously. Soap cleans. That's its job. It cannot become dirty because it IS the cleaning agent.",
    maurice: "You say the soap becomes dirty. It touched the floor. Floors are dirty. The soap is now contaminated. You've ended friendships over this.",
  },
];

function getRandomTopic() {
  return TOPICS[Math.floor(Math.random() * TOPICS.length)];
}

const CONFIG = {
  personaA: {
    name: "Gloria",
    avatarId: "211ed0bc-9dd3-4171-bdc9-e6de9bce63a3",
    voiceId: "562ef6c9-d1ab-4571-94d8-5e838cb3a70f",
    avatarModel: "cara-3",
    skipGreeting: false,
    voiceDetectionOptions: {
      silenceBeforeSkipTurnSeconds: 30,
      silenceBeforeSessionEndSeconds: 60,
      silenceBeforeAutoEndTurnSeconds: 10,
    },
  },
  personaB: {
    name: "Maurice",
    avatarId: "e2ff8764-9986-4f5a-b540-f5a913e53ed2",
    voiceId: "6af524f7-68e3-4ecd-933d-c06e3d8ef9b8",
    avatarModel: "cara-3",
    skipGreeting: true,
    voiceDetectionOptions: {
      silenceBeforeSkipTurnSeconds: 30,
      silenceBeforeSessionEndSeconds: 60,
      silenceBeforeAutoEndTurnSeconds: 10,
    },
  },
  llmId: "88190a76-3e87-4935-ab39-f4f73038815a",
};

const apiKey = import.meta.env.VITE_ANAM_API_KEY;

// DOM Elements
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const newTopicBtn = document.getElementById("new-topic-btn") as HTMLButtonElement;

// Timestamped logging
function log(message: string) {
  const now = new Date();
  const ts = now.toTimeString().split(' ')[0] + '.' + now.getMilliseconds().toString().padStart(3, '0');
  console.log(`[${ts}] ${message}`);
}

// State
let clientA: AnamClient | null = null;
let clientB: AnamClient | null = null;
let isRunning = false;
const conversationManager = new ConversationManager();

// Session token exchange
async function getSessionToken(personaConfig: typeof CONFIG.personaA, systemPrompt: string): Promise<string> {
  const response = await fetch("https://api.anam.ai/v1/auth/session-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personaConfig: {
        name: personaConfig.name,
        avatarId: personaConfig.avatarId,
        voiceId: personaConfig.voiceId,
        avatarModel: personaConfig.avatarModel,
        llmId: CONFIG.llmId,
        systemPrompt: systemPrompt,
        skipGreeting: personaConfig.skipGreeting,
        voiceDetectionOptions: personaConfig.voiceDetectionOptions,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get session token: ${error}`);
  }

  const data = await response.json();
  return data.sessionToken;
}

// Initialize both clients in parallel
async function initializeClients() {
  // Pick a random topic
  const topic = getRandomTopic();
  log(`Topic selected: ${topic.topic}`);

  // Build system prompts
  const gloriaPrompt = `You are Gloria, having a passionate debate with Maurice about ${topic.topic}.

${topic.gloria}

Keep responses to 1-2 sentences. Be passionate. Start by stating your position on the topic.`;

  const mauricePrompt = `You are Maurice, having a passionate debate with Gloria about ${topic.topic}.

${topic.maurice}

Keep responses to 1-2 sentences. Be equally passionate. Respond to what Gloria says and defend your position.`;

  // Get both tokens in parallel
  log("Requesting session tokens...");
  const [tokenA, tokenB] = await Promise.all([
    getSessionToken(CONFIG.personaA, gloriaPrompt),
    getSessionToken(CONFIG.personaB, mauricePrompt),
  ]);
  log("Session tokens received");

  // Create both clients
  log("Creating clients...");
  clientA = createClient(tokenA);
  clientB = createClient(tokenB);

  // Mute both mics
  clientA.muteInputAudio();
  clientB.muteInputAudio();

  // Start both streams in parallel
  log("Starting streams...");
  await Promise.all([
    clientA.streamToVideoElement("video-a"),
    clientB.streamToVideoElement("video-b"),
  ]);
  log("Streams started");

  // Ensure videos are unmuted for audio
  const videoA = document.getElementById("video-a") as HTMLVideoElement;
  const videoB = document.getElementById("video-b") as HTMLVideoElement;
  if (videoA) { videoA.muted = false; videoA.volume = 1.0; }
  if (videoB) { videoB.muted = false; videoB.volume = 1.0; }

  return { clientA, clientB };
}

// Start conversation
async function startConversation() {
  log("Starting conversation...");
  startBtn.disabled = true;
  startBtn.textContent = "Starting...";
  newTopicBtn.style.display = "none";

  try {
    log("Fetching session tokens...");
    await initializeClients();
    log("Clients initialized, starting conversation manager");

    if (clientA && clientB) {
      conversationManager.setClients(clientA, clientB);
      conversationManager.setCallbacks({
        onMaxTurnsReached: () => {
          log("Max turns reached, auto-stopping session");
          stopConversation();
        },
      });
      conversationManager.start();
      isRunning = true;
      startBtn.style.display = "none";
      newTopicBtn.style.display = "block";
      newTopicBtn.disabled = false;
      log("Conversation started");
    }
  } catch (err) {
    console.error("Failed to start:", err);
    startBtn.textContent = "Start";
    startBtn.disabled = false;
  }
}

// Stop conversation
async function stopConversation() {
  log("Stopping conversation...");

  conversationManager.stop();

  if (clientA) {
    try {
      if (clientA.isStreaming()) {
        await clientA.stopStreaming();
      }
    } catch (e) {
      console.error("Error stopping client A:", e);
    }
    clientA = null;
  }

  if (clientB) {
    try {
      if (clientB.isStreaming()) {
        await clientB.stopStreaming();
      }
    } catch (e) {
      console.error("Error stopping client B:", e);
    }
    clientB = null;
  }

  isRunning = false;
  conversationManager.reset();
  log("Conversation stopped");
}

// New topic - stop and restart with fresh topic
async function newTopic() {
  log("New topic requested, restarting...");
  newTopicBtn.disabled = true;
  newTopicBtn.textContent = "Restarting...";

  await stopConversation();

  // Small delay to ensure cleanup
  await new Promise(resolve => setTimeout(resolve, 100));

  // Reset buttons for fresh start
  startBtn.style.display = "none";
  newTopicBtn.textContent = "New Topic";

  await startConversation();
}

// Event listeners
startBtn.addEventListener("click", startConversation);
newTopicBtn.addEventListener("click", newTopic);

// Handle autoplay policy
document.addEventListener("click", () => {
  const videoA = document.getElementById("video-a") as HTMLVideoElement;
  const videoB = document.getElementById("video-b") as HTMLVideoElement;
  if (videoA) { videoA.muted = false; videoA.play().catch(() => {}); }
  if (videoB) { videoB.muted = false; videoB.play().catch(() => {}); }
}, { once: true });
