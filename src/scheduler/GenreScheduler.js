const cron = require('node-cron');
const config = require('../../config.json');

class GenreScheduler {
    constructor(radioPlayer) {
        this.player = radioPlayer;
    }

    start() {
        // Cek setiap jam, di menit ke 0 (Paksa sistem menggunakan jam WIB)
        cron.schedule('0 * * * *', () => {
            this.checkAndUpdateGenre();
        }, {
            scheduled: true,
            timezone: "Asia/Jakarta" // Pengunci Zona Waktu Server (WIB)
        });
        
        // Pengecekan pertama saat bot nyala
        this.checkAndUpdateGenre();
    }

    checkAndUpdateGenre() {
        // Mengonversi waktu server apapun menjadi format string wilayah Jakarta
        const timeNowString = new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"});
        // Ekstrak jam aslinya dalam format angka
        const hour = new Date(timeNowString).getHours();
        
        let newGenre = 'lofi chill'; // Default fallback

        for (const [timeRange, genre] of Object.entries(config.scheduler)) {
            const [startStr, endStr] = timeRange.split('-');
            const startHour = parseInt(startStr.split(':')[0]);
            let endHour = parseInt(endStr.split(':')[0]);
            
            if (endHour === 0) endHour = 24; // Handle format 23:59/00:00

            if (hour >= startHour && hour < endHour) {
                newGenre = genre;
                break;
            }
        }

        console.log(`[SCHEDULER] Waktu di Jakarta menunjukkan jam ${hour}. Set genre ke: ${newGenre}`);
        this.player.setGenre(newGenre);
    }
}

module.exports = GenreScheduler;
