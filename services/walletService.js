import { execute } from '../config/db';
import { sendMessage } from '../bot'; // 텔레그램 봇 인스턴스

// 유저가 등록되어 있는지 확인하는 함수
export const isUserRegistered = async (chatId) => {
  try {
    const [rows] = await execute(
      'SELECT * FROM wallets WHERE chat_id = ?',
      [chatId]
    );
    return rows.length > 0;
  } catch (error) {
    console.error('유저 등록 확인 중 오류:', error);
    return false;
  }
};

// 지갑을 저장하는 함수
export const saveWallet = async (chatId, walletAddress) => {
  try {
    const userExists = await isUserRegistered(chatId);

    if (userExists) {
      await sendMessage(chatId, '⚠️ 이미 등록된 지갑이 있습니다.');
      return;
    }

    await execute(
      'INSERT INTO wallets (chat_id, wallet_address_trx, wallet_address_usdt) VALUES (?, ?, ?)',
      [chatId, walletAddress, walletAddress]
    );

    await sendMessage(chatId, '✅ 새로운 지갑 주소가 성공적으로 저장되었습니다.');
  } catch (error) {
    console.error('지갑 저장 중 오류:', error);
    await sendMessage(chatId, '❌ 지갑 저장 중 오류가 발생했습니다.');
  }
};

export default { isUserRegistered, saveWallet };
