import dotenv from "dotenv";
dotenv.config();

import axios from "axios";
import { sendMessage } from "../bot.js"; // 텔레그램 봇 인스턴스
import { execute } from "../config/db.js"; // DB 연결
import { TronWeb } from "tronweb";

// ✅ TronWeb 인스턴스 생성 (주소 디코딩용)
const tronWeb = new TronWeb({
  fullHost: "https://api.trongrid.io",
  headers: { "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY },
});

const tronGridUrl = "https://api.trongrid.io";

// 🔥 TronGrid 요청용 axios 인스턴스
const axiosInstance = axios.create({
  baseURL: tronGridUrl,
  headers: {
    "TRON-PRO-API-KEY": process.env.TRONGRID_API_KEY, 
  },
});

// 🔍 트랜잭션 조회
const checkTransactions = async (walletAddressTrx, walletAddressUsdt) => {
  if (!walletAddressTrx || !walletAddressUsdt) {
    console.error("지갑 주소가 유효하지 않습니다.");
    return { trxTransactions: [], usdtTransactions: [] };
  }

  try {
    const trxRes = await axiosInstance.get(
      `/v1/accounts/${walletAddressTrx}/transactions?limit=10`
    );
    const trxTransactions = trxRes.data.data || [];

    const usdtRes = await axiosInstance.get(
      `/v1/accounts/${walletAddressUsdt}/transactions/trc20?limit=10`
    );
    const usdtTransactions = usdtRes.data.data || [];

    return { trxTransactions, usdtTransactions };
  } catch (error) {
    console.error("트랜잭션 조회 오류:", error.message);
    return { trxTransactions: [], usdtTransactions: [] };
  }
};

// ✅ 트랜잭션 중복 확인
const isTransactionProcessed = async (transactionId) => {
  try {
    const result = await execute(
      "SELECT 1 FROM transactions WHERE transaction_id = ?",
      [transactionId]
    );
    return result.length > 0;
  } catch (error) {
    console.error("트랜잭션 ID 확인 오류:", error.message);
    return false;
  }
};

// ✅ 트랜잭션 저장
const saveTransactionId = async (transactionId) => {
  try {
    await execute("INSERT INTO transactions (transaction_id) VALUES (?)", [
      transactionId,
    ]);
  } catch (error) {
    console.error("트랜잭션 ID 저장 오류:", error.message);
  }
};

// 📢 입금 알림 함수
export const notifyDeposit = async (wallet) => {
  try {
    const { chat_id, wallet_address_trx, wallet_address_usdt } = wallet;

    const { trxTransactions, usdtTransactions } = await checkTransactions(
      wallet_address_trx,
      wallet_address_usdt
    );

    // 🔍 TRX 트랜잭션 처리 (TransferContract + 내 지갑으로 입금)
    const trxTxs = trxTransactions
      .filter((tx) => tx.raw_data?.contract?.[0]?.type === "TransferContract")
      .map((tx) => {
        const contractData = tx.raw_data?.contract?.[0]?.parameter?.value;
        const amount = contractData?.amount;
        const toAddressHex = contractData?.to_address;
        const toAddressBase58 = toAddressHex
          ? tronWeb.address.fromHex(toAddressHex)
          : null;
        const transaction_id = tx.txID || tx.transaction_id;
        const timestamp = tx.block_timestamp;

        return {
          type: "TRX",
          amount: amount / Math.pow(10, 6),
          transaction_id,
          timestamp,
          toAddress: toAddressBase58,
        };
      })
      .filter(
        (tx) =>
          tx.toAddress?.toLowerCase() === wallet_address_trx.toLowerCase() &&
          !isNaN(tx.amount)
      );

    // 🔍 USDT 트랜잭션 처리 (내 지갑으로 입금)
    const usdtTxs = usdtTransactions
      .filter(
        (tx) =>
          tx.to?.toLowerCase() === wallet_address_usdt.toLowerCase() &&
          !isNaN(tx.value)
      )
      .map((tx) => ({
        type: tx.token_info.symbol || "USDT",
        amount: tx.value / Math.pow(10, tx.token_info.decimals),
        transaction_id: tx.transaction_id,
        timestamp: tx.block_timestamp,
      }));

    // 합치고 시간순 정렬
    const allTxs = [...trxTxs, ...usdtTxs].sort(
      (a, b) => b.timestamp - a.timestamp
    );
    for (const tx of allTxs) {
      const { type, amount, transaction_id, timestamp } = tx;

      if (!transaction_id || isNaN(amount)) continue;

      // timestamp가 존재할 때만 시간 포맷팅
      let formattedTime = "알 수 없음";
      if (timestamp) {
        const date = new Date(timestamp);
        formattedTime = date.toLocaleString("ko-KR", {
          timeZone: "Asia/Seoul",
        });
      }

      if (!(await isTransactionProcessed(transaction_id))) {
        const message =
          `💰 [${type} 입금]\n` +
          `금액: ${amount} ${type}\n` +
          `🕒 시간: ${formattedTime}\n` +
          `🔗 트랜잭션: ${transaction_id}`;

        await sendMessage(chat_id, message);
        await saveTransactionId(transaction_id);
      }
    }
  } catch (error) {
    console.error("알림 전송 실패:", error.response?.data || error.message);
  }
};

// 🔁 주기적 실행 (10초마다)
setInterval(async () => {
  try {
    const wallets = await execute(
      "SELECT chat_id, wallet_address_trx, wallet_address_usdt FROM wallets"
    );

    if (wallets.length === 0) return;

    await Promise.all(wallets.map((wallet) => notifyDeposit(wallet)));
  } catch (error) {
    console.error("지갑 입금 조회 오류:", error.message);
  }
}, 30000);

export default { notifyDeposit };
