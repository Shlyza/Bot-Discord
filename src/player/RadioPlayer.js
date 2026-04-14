// src/player/RadioPlayer.js
const googleTTS = require('google-tts-api');
const config = require('../../config.json');

class RadioPlayer {
    constructor(client, shoukaku) {
        this.client = client;
        this.shoukaku = shoukaku;
        this.player = null; 
        this.currentGenre = 'lofi chill';
        this.engine = 'youtube'; // Udah aman pakai YouTube berkat Lavalink
        this.history = [];
        this.songCount = 0;
        this.isPlaying = false;
    }

    async joinAndStart(channelId, guildId) {
        try {
            const node = this.shoukaku.getIdealNode();
            if (!node) throw new Error('Genset Lavalink belum terdeteksi!');

            this.player = await this.shoukaku.joinVoiceChannel({
                guildId: guildId,
                channelId: channelId,
                shardId: 0
            });

            console.log('[RADIO] Berhasil masuk Voice Channel via Lavalink!');

            this.player.on('end', (reason) => {
                console.log('[DEBUG] Track End Reason:', reason);
                this.isPlaying = false;
                this.playNext();
            });

            this.player.on('exception', (err) => {
                console.error('[DEBUG] Lavalink Track Exception:', err);
            });

            this.player.on('closed', () => this.leave());
            this.player.on('error', (err) => {
                console.error('[LAVALINK PLAYER ERROR]', err);
                this.isPlaying = false;
                // Jeda sebentar sebelum coba putar lagu lain saat error
                setTimeout(() => this.playNext(), 2000); 
            });

            this.playNext();
        } catch (error) {
            console.error('[CRITICAL] Gagal Join:', error.message);
        }
    }

    leave() {
        if (this.player) {
            this.isPlaying = false;
            this.shoukaku.leaveVoiceChannel(this.player.guildId);
            this.player = null;
            console.log('[RADIO] Bot keluar dari VC.');
        }
    }

    setEngine(newEngine) {
        if (newEngine === 'youtube' || newEngine === 'soundcloud') {
            this.engine = newEngine;
            this.history = []; 
            console.log(`[RADIO] Dialihkan ke mesin: ${newEngine.toUpperCase()}`);
            if (this.isPlaying && this.player) this.player.stopTrack(); 
            return true;
        }
        return false;
    }

    async playNext() {
        if (this.isPlaying || !this.player) return;

        // Cek apakah sudah waktunya siaran DJ
        if (this.songCount > 0 && this.songCount % config.settings.djVoiceRate === 0) {
            await this.playDJVoice(`Masih di Discord Radio. Saat ini menggunakan mesin ${this.engine}. Selamat mendengarkan.`);
            this.songCount++;
            return;
        }

        try {
            this.isPlaying = true;
            const node = this.shoukaku.getIdealNode();
            if (!node) return;

            // ==========================================
            // PERBAIKAN URL PLAYLIST/LINK
            // ==========================================
            const isUrl = this.currentGenre.startsWith('http://') || this.currentGenre.startsWith('https://');
            const searchPrefix = this.engine === 'youtube' ? 'ytsearch:' : 'scsearch:';
            
            // Jika genre adalah link, jangan tambahkan ytsearch & mix audio.
            // Jika bukan link (kata biasa), pakai rumus pencarian standar.
            const query = isUrl ? this.currentGenre : `${searchPrefix}${this.currentGenre} mix audio`;
            
            console.log(`[${this.engine.toUpperCase()}] Mencari: ${query}`);
            
            const result = await node.rest.resolve(query);

            if (!result || result.loadType === 'empty' || result.loadType === 'error' || !result.data || result.data.length === 0) {
                console.log(`[${this.engine.toUpperCase()}] Waduh, lagu nggak ketemu. Skip otomatis...`);
                this.isPlaying = false;
                setTimeout(() => this.playNext(), 3000);
                return;
            }

            // Normalisasi data dari Lavalink
            let searchData = result.loadType === 'search' || result.loadType === 'playlist' ? result.data : [result.data];
            // Kalau yang masuk adalah Playlist YouTube (misal dari URL), ambil isi tracks-nya
            if (result.loadType === 'playlist') searchData = result.data.tracks;

            // Filter agar lagu tidak berulang (berdasarkan history)
            let validSongs = searchData.filter(song => !this.history.includes(song.info.identifier));
            if (validSongs.length === 0) {
                this.history = []; // Reset history jika semua lagu di daftar sudah pernah diputar
                validSongs = searchData;
            }

            // Pilih lagu acak dari daftar pencarian/playlist yang valid
            const chosenSong = validSongs[Math.floor(Math.random() * validSongs.length)];
            
            // Masukkan ke history
            this.history.push(chosenSong.info.identifier);
            if (this.history.length > 15) this.history.shift(); // Hanya simpan 15 lagu terakhir

            // Eksekusi putar lagu ke Lavalink v4
            await this.player.playTrack({ track: chosenSong.encoded });
            
            console.log(`[RADIO MENGUDARA] 🎵 ${chosenSong.info.title}`);
            this.songCount++;

        } catch (error) {
            console.error('[CRITICAL ERROR]', error.message);
            this.isPlaying = false;
            setTimeout(() => this.playNext(), 3000);
        }
    }

    async playDJVoice(text) {
        this.isPlaying = true;
        // Generate TTS audio URL
        const url = googleTTS.getAudioUrl(text, { lang: 'id', slow: false, host: 'https://translate.google.com' });
        
        try {
            const node = this.shoukaku.getIdealNode();
            const result = await node.rest.resolve(url); 
            if (result && result.data) {
                const trackData = result.loadType === 'track' ? result.data : result.data[0];
                await this.player.playTrack({ track: trackData.encoded });
                console.log(`[DJ] Berbicara...`);
            } else {
                throw new Error("Gagal load TTS");
            }
        } catch (error) {
            this.isPlaying = false;
            this.playNext(); // Lewati DJ kalau TTS gagal
        }
    }

    setGenre(newGenre) {
        if (this.currentGenre !== newGenre) {
            this.currentGenre = newGenre;
            console.log(`[RADIO] Genre ganti ke: ${newGenre}`);
            // Menghentikan lagu saat ini untuk langsung berpindah ke genre/link yang baru
            if (config.settings.skipOnGenreChange && this.player) {
                this.player.stopTrack(); 
            }
        }
    }
}

module.exports = RadioPlayer;
