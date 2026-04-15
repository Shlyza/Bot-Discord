require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { Shoukaku, Connectors } = require('shoukaku');
const RadioPlayer = require('./src/player/RadioPlayer');
const GenreScheduler = require('./src/scheduler/GenreScheduler');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});

// ==========================================
// KONFIGURASI KABEL KE GENSET LAVALINK
// ==========================================
const Nodes = [{
    name: 'Serenetia Lavalink', // Nama bebas, untuk log di terminal
    url: 'lavalinkv4.serenetia.com:443', // Format: Host:Port
    auth: 'https://seretia.link/discord', // Masukkan password di sini
    secure: true // Wajib true karena dari penyedia tertulis true (pakai wss/https)
}];

const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), Nodes);

shoukaku.on('error', (_, error) => console.error('[LAVALINK ERROR]', error));
shoukaku.on('ready', (name) => console.log(`[SYSTEM] Berhasil tersambung ke ${name}! Mesin siap tempur.`));
// ==========================================

// Masukin shoukaku ke dalam RadioPlayer biar bisa dikendalikan
const radio = new RadioPlayer(client, shoukaku);
const scheduler = new GenreScheduler(radio);

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    
    // Jalankan fitur penjadwalan genre
    scheduler.start();
    
    // Tunggu 2 detik biar kabel ke Lavalink kepasang sempurna sebelum auto-join
    setTimeout(() => {
        const channel = client.channels.cache.get(process.env.DEFAULT_VOICE_ID);
        if (channel) {
            radio.joinAndStart(channel.id, channel.guild.id);
        } else {
            console.log('[SYSTEM] Bot siap! Silakan ketik !join di server.');
        }
    }, 2000);
});

client.on('messageCreate', async message => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).split(/ +/);
    const command = args.shift().toLowerCase();

    if (command === 'join') {
        if (message.member.voice.channel) {
            radio.joinAndStart(message.member.voice.channel.id, message.guild.id);
            message.reply('✅ Bergabung ke channel pakai mesin Lavalink!');
        } else {
            message.reply('❌ Masuk voice channel dulu, Pak!');
        }
    }

    if (command === 'leave') {
        radio.leave();
        message.reply('👋 Siap Pak! Mesin dimatikan, bot ijin pamit.');
    }

    if (command === 'skip') {
        if (radio.player) {
            radio.player.stopTrack(); // Di Lavalink, stopTrack otomatis trigger lagu selanjutnya
            message.reply('⏭️ Lagu di-skip pakai jalur VVIP!');
        }
    }

    if (command === 'genre') {
        message.reply(`📻 Genre aktif: **${radio.currentGenre}**`);
    }

    if (command === 'engine') {
        const selectedEngine = args[0]?.toLowerCase();
        if (!selectedEngine) {
            return message.reply(`📻 Mesin saat ini: **${radio.engine.toUpperCase()}**. \nKetik \`!engine youtube\` atau \`!engine soundcloud\`.`);
        }

        if (radio.setEngine(selectedEngine)) {
            message.reply(`🔄 Mesin diganti ke **${selectedEngine.toUpperCase()}**! Request lagu selanjutnya bakal dialihin ke sana.`);
        } else {
            message.reply('❌ Pilihan tidak valid! Pilih: `youtube` atau `soundcloud`.');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);