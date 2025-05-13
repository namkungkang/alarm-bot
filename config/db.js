import { createPool } from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

// MySQL 연결 설정
const db = createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// (1) 사용자 등록 여부 확인 (chat_id 기준)
export const isUserRegistered = async (chatId) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM wallets WHERE chat_id = ?', 
      [chatId]
    );
    return rows.length > 0; // 등록된 사용자 있으면 true
  } catch (error) {
    console.error("DB 조회 중 오류 발생:", error);
    return false;
  }
};

// (2) 지갑 등록 (TRX/USDT 지갑 주소 동시에 저장)
export const saveWallet = async (chatId, walletAddress) => {
  try {
    await db.execute(
      'INSERT INTO wallets (chat_id, wallet_address_trx, wallet_address_usdt) VALUES (?, ?, ?)',
      [chatId, walletAddress, walletAddress]
    );
    return { success: true };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return { success: false, reason: 'duplicate' };
    }
    console.error("지갑 주소 저장 중 오류 발생:", error);
    return { success: false, reason: 'unknown' };
  }
};

// (3) 지갑 주소 등록 여부 확인 (wallet_address_trx OR wallet_address_usdt 둘 다 확인)
export const isWalletRegistered = async (walletAddress) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM wallets WHERE wallet_address_trx = ? OR wallet_address_usdt = ?',
      [walletAddress, walletAddress]
    );
    return rows.length > 0;
  } catch (error) {
    console.error("DB 조회 중 오류 발생:", error);
    return false;
  }
};

// (4) 허용된 채팅(chatId) 등록 여부 확인
export const isChatIdRegistered = async (chatId) => {
  try {
    const [rows] = await db.execute(
      'SELECT * FROM allowed_chats WHERE chatId = ?',
      [chatId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error("DB 조회 중 오류 발생:", error);
    return false;
  }
};

// (5) 허용된 채팅(chatId) 등록
export const saveAllowedChatId = async (chatId) => {
  try {
    await db.execute(
      'INSERT INTO allowed_chats (chatId) VALUES (?)',
      [chatId]
    );
  } catch (error) {
    console.error("허용 채팅 저장 중 오류 발생:", error);
    throw error;
  }
};

// (6) 자유 쿼리 실행
export const execute = async (query, values = []) => {
  try {
    const [results] = await db.execute(query, values);
    return results;
  } catch (error) {
    console.error("DB 쿼리 실행 중 오류 발생:", error);
    throw error;
  }
};
