const SUPABASE_URL = 'https://rrdjjpgfafzxfrtlnzqs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZGpqcGdmYWZ6eGZydGxuenFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3MjY2NTgsImV4cCI6MjA2MjMwMjY1OH0.UhoXjzCoKbfxnypm0-ADn-CG5GgDMcYlB9Ya4aNhmhA';
const PROXY_URL = 'https://dify-proxy-api.onrender.com';

// 匿名ユーザーIDを localStorage に保持
const USER_ID = localStorage.getItem('user_id') || (() => {
  const id = 'user-' + Math.random().toString(36).substring(2, 10);
  localStorage.setItem('user_id', id);
  return id;
})();

const BOT_ICON_URL = 'assets/bot-icon.png';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const chatLog = document.getElementById('chatLog');
const inputBox = document.getElementById('inputBox');
const sendBtn = document.getElementById('sendBtn');
let conversationId = '';

function addMessage(text, type = 'bot') {
  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${type}`;

  const message = document.createElement('div');
  message.className = `message ${type}`;
  message.textContent = text;

  if (type === 'bot') {
    const icon = document.createElement('img');
    icon.className = 'icon';
    icon.src = BOT_ICON_URL;
    wrapper.appendChild(icon);
    wrapper.appendChild(message);
  } else {
    wrapper.appendChild(message);
  }

  chatLog.appendChild(wrapper);
  chatLog.scrollTop = chatLog.scrollHeight;
  return message;
}

async function loadChatHistory() {
  const { data, error } = await supabaseClient
    .from('chat_logs')
    .select('*')
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('履歴取得エラー:', error);
    return;
  }

  data.forEach(entry => {
    addMessage(entry.question, 'user');
    addMessage(entry.answer, 'bot');
  });
}

sendBtn.onclick = async () => {
  const query = inputBox.value.trim();
  if (!query) return;

  addMessage(query, 'user');
  inputBox.value = '';

  const botDiv = addMessage('...', 'bot');

  let loadingDots = 0;
  let animationRunning = true;
  const animInterval = setInterval(() => {
    if (!animationRunning) return;
    loadingDots = (loadingDots + 1) % 4;
    botDiv.textContent = '入力中' + '.'.repeat(loadingDots);
  }, 400);

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: query,
        user: USER_ID,
        response_mode: 'streaming',
        conversation_id: conversationId || undefined,
        inputs: {}
      })
    });

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let botReply = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      chunk.split('\n').forEach(line => {
        if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.replace('data: ', ''));

            if (data.answer) {
              if (animationRunning) {
                animationRunning = false;
                clearInterval(animInterval);
              }

              botReply += data.answer;
              botDiv.textContent = botReply;
              chatLog.scrollTop = chatLog.scrollHeight;
            }

            if (data.conversation_id) {
              conversationId = data.conversation_id;
            }
          } catch (e) {
            console.warn('JSON parse error:', e);
          }
        }
      });
    }

    const { error } = await supabaseClient.from('chat_logs').insert([
      {
        user_id: USER_ID,
        question: query,
        answer: botReply
      }
    ]);
    if (error) {
      console.error('Supabase保存エラー:', error);
      botDiv.textContent += '\n(保存エラー)';
    }

  } catch (error) {
    animationRunning = false;
    clearInterval(animInterval);
    botDiv.textContent = '通信エラー: ' + error.message;
  }

  chatLog.scrollTop = chatLog.scrollHeight;
};

inputBox.addEventListener("keydown", function(event) {
  if (event.key === "Enter") sendBtn.click();
});

window.addEventListener('DOMContentLoaded', () => {
  loadChatHistory();
});
