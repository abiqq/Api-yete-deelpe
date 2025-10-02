# YT-DLP API Server

⚠️ **Disclaimer**: This project is for educational purposes only. Respect copyright laws and platform Terms of Service.

## Deployment

1. Fork this repository
2. Deploy to Vercel: [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)
3. Use the API endpoints

## API Endpoints

- `GET /api/info?url=YOUTUBE_URL` - Get video info
- `GET /api/download/mp3?url=YOUTUBE_URL` - Download as MP3  
- `GET /api/download/mp4?url=YOUTUBE_URL` - Download as MP4
- `GET /api/files` - List files
- `DELETE /api/files/:filename` - Delete file