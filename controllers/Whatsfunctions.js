const axios = require('axios');

const API_BASE_URL = 'http://localhost:3333'; // Substitua pela URL base da sua API
const ADMIN_TOKEN = 'darklindo'; // Substitua pelo seu token de administrador

class WhatsAppController {
    constructor(instanceKey) {
        this.instanceKey = instanceKey;
        this.axiosInstance = axios.create({
            baseURL: API_BASE_URL,
            headers: {
                'Authorization': `Bearer ${ADMIN_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
    }

    async sendTextMessage(recipientId, message, options = {}) {
        try {
            const response = await this.axiosInstance.post(`/message/text?key=${this.instanceKey}`, {
                id: recipientId,
                typeId: "user",
                message: message,
                options: {
                    delay: options.delay || 0,
                    replyFrom: options.replyFrom || ""
                },
                groupOptions: {
                    markUser: "ghostMention"
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error sending text message:', error);
            throw error;
        }
    }

    async sendMediaMessage(recipientId, type, url, caption = '', options = {}) {
        try {
            const response = await this.axiosInstance.post(`/message/sendurlfile?key=${this.instanceKey}`, {
                id: recipientId,
                typeId: "user",
                type: type,
                url: url,
                options: {
                    caption: caption,
                    replyFrom: options.replyFrom || "",
                    delay: options.delay || 0
                }
            });
            return response.data;
        } catch (error) {
            console.error('Error sending media message:', error);
            throw error;
        }
    }

    async getGroupInfo(groupId) {
        try {
            const response = await this.axiosInstance.post(`/group/groupidinfo?key=${this.instanceKey}`, {
                id: groupId
            });
            return response.data;
        } catch (error) {
            console.error('Error getting group info:', error);
            throw error;
        }
    }

    async createGroup(name, users) {
        try {
            const response = await this.axiosInstance.post(`/group/create?key=${this.instanceKey}`, {
                name: name,
                users: users
            });
            return response.data;
        } catch (error) {
            console.error('Error creating group:', error);
            throw error;
        }
    }

    async joinGroup(url) {
        try {
            const response = await this.axiosInstance.post(`/group/join?key=${this.instanceKey}`, {
                url: url
            });
            return response.data;
        } catch (error) {
            console.error('Error joining group:', error);
            throw error;
        }
    }

    async leaveGroup(groupId) {
        try {
            const response = await this.axiosInstance.post(`/group/leave?key=${this.instanceKey}`, {
                id: groupId
            });
            return response.data;
        } catch (error) {
            console.error('Error leaving group:', error);
            throw error;
        }
    }

    async getProfilePic(userId) {
        try {
            const response = await this.axiosInstance.post(`/misc/downProfile?key=${this.instanceKey}`, {
                id: userId
            });
            return response.data;
        } catch (error) {
            console.error('Error getting profile picture:', error);
            throw error;
        }
    }

    async updateProfilePic(imageUrl) {
        try {
            const response = await this.axiosInstance.post(`/misc/updateProfilePicture?key=${this.instanceKey}`, {
                url: imageUrl,
                type: "user"
            });
            return response.data;
        } catch (error) {
            console.error('Error updating profile picture:', error);
            throw error;
        }
    }

    async getContacts() {
        try {
            const response = await this.axiosInstance.get(`/misc/contacts?key=${this.instanceKey}`);
            return response.data;
        } catch (error) {
            console.error('Error getting contacts:', error);
            throw error;
        }
    }
}

module.exports = WhatsAppController;