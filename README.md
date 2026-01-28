# Ocean Air Travels - AI Report Generator

An internal tool for GREs (Guest Relations Executives) to transform raw WhatsApp feedback from tour guides into professional, partner-facing reports for platforms like GetYourGuide, Viator, and others.

## Features

- **WhatsApp Feedback Input**: Paste unstructured guide feedback directly
- **Smart Analysis**: Automatically identifies food issues, customer behavior, expectation mismatches, and guide responses
- **Platform Presets**: Optimized formatting for GetYourGuide, Viator, and generic partner communications
- **Tone Selection**: Choose between Neutral, Soft & Apologetic, or Firm but Polite tones
- **Editable Output**: Review and modify the generated report before sending
- **One-Click Copy**: Instantly copy the final report to clipboard

## Tech Stack

- **Frontend**: React 18 with Vite
- **Backend**: Node.js with Express
- **AI**: OpenAI GPT-4 for intelligent report generation

## Setup

### Prerequisites

- Node.js 18 or higher
- Gemini API key (recommended) or OpenAI API key

### Installation

1. Clone the repository and navigate to the project folder:

```bash
cd "review writer"
```

2. Install root dependencies:

```bash
npm install
```

3. Install client dependencies:

```bash
cd client && npm install && cd ..
```

4. Create your environment file:

```bash
cp .env.example .env
```

5. Add your OpenAI API key to the `.env` file:

```
OPENAI_API_KEY=sk-your-api-key-here
```

Or use Gemini (recommended):

```
GEMINI_API_KEY=AIzaSy-your-gemini-key-here
```

### Running the Application

**Development mode** (runs both frontend and backend concurrently):

```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- API: http://localhost:3001

**Production build**:

```bash
npm run build
npm start
```

## Usage

1. **Paste Feedback**: Enter the raw WhatsApp message from the tour guide
2. **Add Details** (optional): Include customer name, booking reference, tour name, meal type, and additional guide remarks
3. **Select Platform**: Choose the target platform format (GetYourGuide, Viator, or Generic)
4. **Choose Tone**: Select the appropriate tone for the situation
5. **Generate**: Click the generate button to create the professional report
6. **Review & Edit**: Make any necessary adjustments to the generated text
7. **Copy**: Use one-click copy to transfer the report to your email or dashboard

## AI Writing Guidelines

The system follows these principles:

- Writes as a senior operations executive (human voice)
- Never uses defensive or accusatory language
- Avoids words like "complaint", "fault", "problem"
- Uses professional phrases: "kindly note", "as a proactive update"
- Varies sentence structure for natural flow
- Outputs plain text (no markdown, emojis, or bullet points)
- Never mentions AI or automated generation

## Project Structure

```
review writer/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main application component
│   │   ├── index.css      # Global styles
│   │   └── main.jsx       # Entry point
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   └── index.js           # Express API server
├── .env.example           # Environment template
├── package.json           # Root package with scripts
└── README.md
```

## API Endpoints

### POST /api/generate-report

Generates a professional report from raw feedback.

**Request Body:**
```json
{
  "rawFeedback": "string (required)",
  "customerName": "string (optional)",
  "bookingReference": "string (optional)",
  "platform": "getyourguide | viator | generic",
  "tourName": "string (optional)",
  "guideRemarks": "string (optional)",
  "mealType": "string (optional)",
  "tone": "neutral | soft | firm"
}
```

**Response:**
```json
{
  "report": "Generated report text",
  "analysis": {
    "foodIssues": boolean,
    "customerBehavior": "string",
    "expectationMismatch": "string",
    "guideResponse": "string"
  },
  "metadata": {
    "platform": "string",
    "tone": "string",
    "generatedAt": "ISO timestamp"
  }
}
```

### GET /api/health

Health check endpoint.

## License

Internal use only - Ocean Air Travels
