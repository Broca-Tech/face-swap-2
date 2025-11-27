# Akool Live Face Swap MVP

This is a Next.js application that integrates Akool's Live Face Swap API with Agora for real-time video streaming.

## Setup

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Environment Variables:**
    Create a `.env.local` file in the root directory with the following keys:
    ```env
    # Akool API Credentials
    AKOOL_API_KEY=your_akool_api_key_here

    # Agora Credentials
    NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id_here
    ```
    *Note: You can find these keys in your existing project or Akool/Agora dashboards.*

3.  **Source Image:**
    Follow the instructions in `UPLOAD_INSTRUCTIONS.md` to set the target face image URL in `app/api/start-swap/route.ts`.

4.  **Run the App:**
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1.  Click **Start Camera** to enable your webcam.
2.  Once the camera is running, click **Start Face Swap**.
3.  The app will join an Agora channel and trigger the Akool API.
4.  The swapped video feed should appear in the "Swapped Feed" box.

## Troubleshooting

*   **Camera not working:** Ensure you have granted browser permissions.
*   **Swap not starting:** Check the server console for API errors. Ensure your API Key is correct.
*   **Agora Connection Failed:** Check your App ID. Ensure your firewall allows UDP traffic.
