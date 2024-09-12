const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const github = require('../config/git');

async function downloadAndSaveMedia(mediaData, mediaType) {
  const mediaId = uuidv4();
  const tempDir = path.join(__dirname, '..', 'temp');
  const tempFilePath = path.join(tempDir, `${mediaId}.${mediaType}`);

  try {
    // Ensure temp directory exists
    await fs.mkdir(tempDir, { recursive: true });

    // Write media data to temp file
    await fs.writeFile(tempFilePath, Buffer.from(mediaData, 'base64'));

    // Upload to GitHub
    const mediaUrl = await uploadMediaToGithub({
      path: tempFilePath
    }, mediaType, github);

    return mediaUrl;
  } catch (error) {
    console.error('Error in downloadAndSaveMedia:', error);
    throw error;
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempFilePath);
    } catch (unlinkError) {
      console.error('Error deleting temp file:', unlinkError);
    }
  }
}

async function uploadMediaToGithub(file, type, github) {
  let base64File;
  let mediaUrl;

  try {
    base64File = await fs.readFile(file.path, { encoding: 'base64' });

    const filename = uuidv4();
    let nomearqv;
    if (type === "image") {
      nomearqv = filename + ".jpg";
    } else if (type === "audio") {
      nomearqv = filename + ".mp3";
    } else if (type === "video") {
      nomearqv = filename + ".mp4";
    } else {
      nomearqv = filename + "." + type;
    }

    const response = await axios.put(
      `https://api.github.com/repos/${github.GITHUB_USERNAME}/${github.GITHUB_REPO}/contents/${nomearqv}`,
      {
        message: `Upload de ${type} via API`,
        content: base64File
      },
      {
        headers: {
          'Authorization': `token ${github.GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    mediaUrl = response.data.content.download_url;
    console.log(`${type} hospedado com sucesso no GitHub:`, mediaUrl);
  } catch (error) {
    console.error(`Erro ao hospedar o arquivo no GitHub:`, error);
    throw error;
  }

  return mediaUrl;
}

async function uploadbase64(base64File, type, github) {

  let mediaUrl;

  try {
   

    const filename = uuidv4();
    let nomearqv;
    if (type === "image") {
      nomearqv = filename + ".jpg";
    } else if (type === "audio") {
      nomearqv = filename + ".mp3";
    } else if (type === "video") {
      nomearqv = filename + ".mp4";
    } else {
      nomearqv = filename + "." + type;
    }

    const response = await axios.put(
      `https://api.github.com/repos/${github.GITHUB_USERNAME}/${github.GITHUB_REPO}/contents/${nomearqv}`,
      {
        message: `Upload de ${type} via API`,
        content: base64File
      },
      {
        headers: {
          'Authorization': `token ${github.GITHUB_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    mediaUrl = response.data.content.download_url;
    console.log(`${type} hospedado com sucesso no GitHub:`, mediaUrl);
  } catch (error) {
    console.error(`Erro ao hospedar o arquivo no GitHub:`, error);
    throw error;
  }

  return mediaUrl;
}

module.exports = {
  downloadAndSaveMedia,
  uploadbase64
};