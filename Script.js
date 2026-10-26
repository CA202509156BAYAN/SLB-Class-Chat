const SUPABASE_URL = "https://vvqwsgtwnuliiiiqkjkn.supabase.co";      
const SUPABASE_KEY = "sb_publishable_vi3xvec3zI8YXnqDydYGew_oYuI7TVW"; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const authScreen = document.getElementById("auth-screen");
const chatScreen = document.getElementById("chat-screen");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authName = document.getElementById("auth-name");
const authError = document.getElementById("auth-error");
const signinBtn = document.getElementById("signin-btn");
const signupBtn = document.getElementById("signup-btn");
const logoutBtn = document.getElementById("logout-btn");

const messageList = document.getElementById("messages");
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message-input");
const clearBtn = document.getElementById("clear-btn");
const userDisplay = document.getElementById("user-display");

let currentUser = null;
let messages = [];

async function checkUserSession() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadUserProfile();
    showChatScreen();
  } else {
    showAuthScreen();
  }
}

async function loadUserProfile() {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("display_name")
    .eq("id", currentUser.id)
    .single();

  if (data) {
    currentUser.displayName = data.display_name;
    userDisplay.textContent = "Signed in as: " + currentUser.displayName;
  }
}

function showAuthScreen() {
  authScreen.classList.remove("hidden");
  chatScreen.classList.add("hidden");
}

function showChatScreen() {
  authScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  fetchMessages();
  subscribeToRealtime();
}

// Sign Up
signupBtn.addEventListener("click", async () => {
  authError.textContent = "";
  const email = authEmail.value.trim();
  const password = authPassword.value;
  const displayName = authName.value.trim();

  if (!email || !password || !displayName) {
    authError.textContent = "Please fill in all fields.";
    return;
  }

  const { data, error } = await supabaseClient.auth.signUp({
    email: email,
    password: password,
    options: {
      data: { display_name: displayName }
    }
  });

  if (error) {
    authError.textContent = error.message;
  } else {
    alert("Account created successfully! You are now logged in.");
    checkUserSession();
  }
});

// INAYOS NA SIGN IN (Gamit na ang signinBtn sa halip na authForm submit)
signinBtn.addEventListener("click", async () => {
  authError.textContent = "";
  const email = authEmail.value.trim();
  const password = authPassword.value;

  if (!email || !password) {
    authError.textContent = "Please enter your email and password.";
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password,
  });

  if (error) {
    authError.textContent = error.message;
  } else {
    checkUserSession();
  }
});

logoutBtn.addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  currentUser = null;
  showAuthScreen();
});

async function fetchMessages() {
  const { data, error } = await supabaseClient
    .from("messages")
    .select("id, content, created_at, profiles(display_name, id)")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching messages:", error);
    return;
  }

  messages = data.map((m) => ({
    id: m.id,
    text: m.content,
    sender: m.profiles ? m.profiles.display_name : "Unknown",
    userId: m.profiles ? m.profiles.id : null,
    time: new Date(m.created_at).getTime(),
  }));

  renderMessages();
}

function renderMessages() {
  messageList.innerHTML = "";

  if (messages.length === 0) {
    const empty = document.createElement("li");
    empty.className = "empty";
    empty.textContent = "No messages yet. Start the conversation!";
    messageList.appendChild(empty);
    return;
  }

  messages.forEach((msg) => {
    const item = document.createElement("li");
    const isMine = currentUser && msg.userId === currentUser.id;

    item.className = isMine ? "message mine" : "message";

    const author = document.createElement("span");
    author.className = "author";
    author.textContent = msg.sender;

    const text = document.createElement("p");
    text.textContent = msg.text;

    const time = document.createElement("time");
    time.textContent = new Date(msg.time).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });

    item.append(author, text, time);
    messageList.appendChild(item);
  });

  messageList.scrollTop = messageList.scrollHeight;
}

messageForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (text === "") return;

  const { error } = await supabaseClient
    .from("messages")
    .insert([{ content: text }]);

  if (error) {
    console.error("Error sending message:", error);
    alert("Failed to send message.");
  } else {
    messageInput.value = "";
    messageInput.focus();
    handleCommand(text);
  }
});


clearBtn.addEventListener("click", async () => {
  if (confirm("Delete all your messages?")) {
    const { error } = await supabaseClient
      .from("messages")
      .delete()
      .eq("user_id", currentUser.id);

    if (error) {
      console.error("Error clearing messages:", error);
    } else {
      fetchMessages();
    }
  }
});

function subscribeToRealtime() {
  supabaseClient
    .channel("public:messages")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      async (payload) => {
        const { data: profileData } = await supabaseClient
          .from("profiles")
          .select("display_name")
          .eq("id", payload.new.user_id)
          .single();

        messages.push({
          id: payload.new.id,
          text: payload.new.content,
          sender: profileData ? profileData.display_name : "Unknown",
          userId: payload.new.user_id,
          time: new Date(payload.new.created_at).getTime(),
        });

        renderMessages();
      }
    )
    .subscribe();
}

const GEO_URL = "https://geocoding-api.open-meteo.com/v1/search";
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";

function describeWeather(code) {
  if (code === 0) return "clear sky";
  if (code <= 3) return "partly cloudy";
  if (code <= 48) return "foggy";
  if (code <= 57) return "drizzle";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain showers";
  if (code <= 86) return "snow showers";
  return "thunderstorm";
}

async function getWeather(city) {
  const geoUrl = GEO_URL + "?name=" + encodeURIComponent(city) + "&count=1";
  const geoResponse = await fetch(geoUrl);
  if (!geoResponse.ok) throw new Error("Geocoding failed");
  const geoData = await geoResponse.json();

  if (!geoData.results) {
    return "Sorry, I could not find a city named " + city + ".";
  }

  const place = geoData.results[0];
  const weatherUrl =
    WEATHER_URL +
    "?latitude=" + place.latitude +
    "&longitude=" + place.longitude +
    "&current=temperature_2m,weather_code,wind_speed_10m";

  const weatherResponse = await fetch(weatherUrl);
  if (!weatherResponse.ok) throw new Error("Weather failed");
  const weatherData = await weatherResponse.json();
  const now = weatherData.current;

  return (
    place.name + ", " + place.country + ": " +
    now.temperature_2m + "°C, " +
    describeWeather(now.weather_code) + ", wind " +
    now.wind_speed_10m + " km/h"
  );
}

async function handleCommand(text) {
  const words = text.split(" ");
  if (words[0].toLowerCase() !== "/weather") return;

  const city = words.slice(1).join(" ").trim();
  let reply;

  if (city === "") {
    reply = "Try it like this: /weather Manila";
  } else {
    try {
      reply = await getWeather(city);
    } catch (error) {
      console.error(error);
      reply = "Sorry, the weather service is not answering right now.";
    }
  }

  await supabaseClient.from("messages").insert([{ content: reply }]);
}

checkUserSession();
