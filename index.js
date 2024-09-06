const axios = require("axios");
const cheerio = require("cheerio");
const path = require("path");
const fs = require("fs");
const pLimit = require("p-limit");
const magicCodes = require('./codes.json')

const limitFn = pLimit(2);

// 延遲
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 擷取圖片 URL 的函數
async function scrapeImagesFromCode(code) {
  try {
    // 發送 HTTP 請求以取得 HTML
    const url = `https://nhentai.net/g/${code}`
    const { data } = await axios.get(url);
    const dir = path.basename(url);

    // 使用 cheerio 解析 HTML
    const $ = cheerio.load(data);

    // 選擇所有 #thumbnail-container 裡面的 <img> 標籤
    $("#thumbnail-container .gallerythumb img").each(async (index, element) => {
      const imageUrl = $(element).attr("data-src");
      if (imageUrl) {
        const bigImageUrl = imageUrl.replace(
          /^https:\/\/t(\d)\.nhentai\.net\/galleries\/(\d+)\/(\d+)t\.jpg/i,
          "https://i$1.nhentai.net/galleries/$2/$3.jpg"
        );
        await limitFn(() => downloadImage(dir, bigImageUrl));
      }
    });
  } catch (error) {
    console.error(`Error fetching images from ${url}:`, error);
  }
}

// 建立目錄
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (!fs.existsSync(dirname)) {
    fs.mkdirSync(dirname, { recursive: true }); // 使用 recursive 创建多层目录
  }
}

// 下載圖片
async function downloadImage(dir, url) {
  const response = await axios({
    url,
    responseType: "stream",
  });

  const fileName = path.basename(url);
  const filePath = path.join("galleries", dir, fileName);

  ensureDirectoryExistence(filePath);

  // 儲存圖片
  const writer = fs.createWriteStream(filePath);
  response.data.pipe(writer);

  // 確保正確儲存
  return new Promise((resolve, reject) => {
    writer.on("finish", () => {
      console.log(`Download ${filePath} complete.`);
      resolve(true);
    });
    writer.on("error", reject);
  });
}

// 處理所有網址
async function scrapeAll() {
  for (const code of magicCodes) {
    await scrapeImagesFromCode(code);
    await delay(1000);
  }
}

scrapeAll();
