# AIStudio

**Create. Transform. Go Live.**

A full-stack web platform for AI face transformation, voice conversion and live streaming, with user accounts and a credit-based billing system that takes real payments.

🔗 **Live demo:** https://aistud-io.up.railway.app/index.html

## Screenshots


![Landing page](landing.jpg)




![Face Studio](face-studio.jpg)




![Dashboard](dashboard.jpg)



## Features
- **Face Studio:** record first, transform after. Swap identity, change or remove the background, and restyle outfit and appearance. Powered by Decart's Lucy.
- **Voice Studio:** real-time and non-real-time voice conversion and cloning. Powered by ElevenLabs.
- **Live Studio:** face and voice transformation together, live, with browser-based streaming or OBS output.
- **User accounts:** registration, login and secure sessions.
- **Credits system:** pay-as-you-go billing per second of use (face 6 credits/sec, voice 2 credits/sec, face + voice 8 credits/sec). Credits never expire.
- **Real payments:** checkout powered by Paystack.
- **Dashboard:** credit balance, AI usage, current plan, projects and analytics.
- **Admin panel:** manage users and platform activity.

## Tech Stack
| Layer | Technologies |
|---|---|
| Frontend | HTML, CSS, JavaScript |
| Backend | PHP, Python |
| Database | SQL |
| Payments | Paystack |
| AI APIs | Decart Lucy (video), ElevenLabs (voice) |
| Deployment | Docker, Railway |

## Project Structure
- `backend/`: server-side logic
- `python/`: Python services
- `sql/`: database schema
- `js/`, `css/`, `browser-modules/`: frontend code
- `media/`: demo assets
- `*.php`: pages (login, dashboard, face-studio, voice-studio, live-studio, buy-credits, admin)
- `Dockerfile`, `Procfile`, `start.sh`: deployment

## Run Locally
1. Clone the repo:
   `git clone https://github.com/Miracle6php/ai-platform.git`
2. Create your environment config and add your own API keys for Decart, ElevenLabs and Paystack. [list the variable names you use]
3. Set up the database using the files in `sql/`.
4. Start the app: [your start command, e.g. `./start.sh`]

> Never commit real API keys. Keep them in environment variables.

## Responsible Use
AIStudio is for creative and entertainment use. Transformation should only be used with appropriate authorization, for your own likeness, or for fictional characters. Unauthorized impersonation, fraud and deceptive use are not supported.

## Author
**Miracle Ogbobe**, web developer based in Nigeria.
[Your LinkedIn link]