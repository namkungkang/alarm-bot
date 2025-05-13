import {
    saveWallet,
    isUserRegistered,
    isWalletRegistered,
    isChatIdRegistered,
    saveAllowedChatId,
    execute,
  } from "./config/db.js";
  import { notifyDeposit } from "./services/notificationService.js"; 
  import TelegramBot from "node-telegram-bot-api";
  
  const token = process.env.TELEGRAM_TOKEN;
  const allowedUserId = 7970761885; // 관리자 user id
  const bot = new TelegramBot(token, { polling: true });
  
  // 메세지 전송 함수
  export const sendMessage = (chatId, message) => {
    bot.sendMessage(chatId, message);
  };
  
  // 봇 상태 로그
  bot.on("polling_error", (error) => console.error(error));
  bot.on("polling", () => console.log("✅ 서버가 정상적으로 실행되고 있습니다!"));
  
  // /start 명령어
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
  
    console.log("당신의 userId:", userId);
  
    sendMessage(chatId, 
      "안녕하세요! 👋\n저는 트론 지갑 알림 봇입니다.\n\n지갑 주소를 등록하려면 /register 를 입력하세요."
    );
  });
  
  // /register 명령어
  bot.onText(/\/register/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
  
    if (userId !== allowedUserId) {
      sendMessage(chatId, "🚫 이 명령은 관리자만 실행할 수 있습니다.");
      return;
    }
  
    const isAllowed = await isChatIdRegistered(chatId);
    if (!isAllowed) {
      await saveAllowedChatId(chatId);
      sendMessage(chatId, "✅ 방이 등록되었습니다. 이제 사용 가능합니다!");
    } else {
      sendMessage(chatId, "⚠️ 이미 등록된 방입니다.");
    }
  
    const alreadyRegistered = await isUserRegistered(chatId);
    if (alreadyRegistered) {
      sendMessage(chatId, "⚠️ 이미 하나의 지갑 주소가 등록되어 있습니다.");
    } else {
      sendMessage(chatId, "📝 트론 지갑 주소를 입력해주세요:");
    }
  });
  
  // 사용자가 지갑 주소를 입력할 때
  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
  
    if (!text || text.startsWith("/")) return;
  
    const isAllowed = await isChatIdRegistered(chatId);
    if (!isAllowed) return;
  
    const isValidTronAddress = (address) => /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
  
    if (isValidTronAddress(text)) {
      const alreadyRegistered = await isUserRegistered(chatId);
      const walletAlreadyUsed = await isWalletRegistered(text);
  
      if (alreadyRegistered) {
        sendMessage(chatId, "⚠️ 이미 하나의 지갑 주소가 등록되어 있습니다.");
      } else if (walletAlreadyUsed) {
        sendMessage(chatId, "🚫 이 지갑 주소는 이미 다른 사용자에 의해 등록되었습니다.");
      } else {
        await saveWallet(chatId, text);
        sendMessage(chatId, `✅ 지갑 주소가 성공적으로 등록되었습니다: ${text}`);
      }
    } 
  });
  
  // 입금 알림 주기적으로 체크
  setInterval(async () => {
    try {
      const wallets = await execute(
        "SELECT chat_id, wallet_address_trx AS wallet_address FROM wallets"
      );
  
      for (const wallet of wallets) {
        await notifyDeposit(wallet);
      }
    } catch (error) {
      console.error("DB 조회 오류:", error);
    }
  }, 30000);
  