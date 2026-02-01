# Balloon Shooter (JS Node.js Learning Project)

## How to Run
1. Open this folder in VS Code.
2. Open a terminal (`Ctrl + ~`).
3. Run `npm install` (if you haven't already).
4. Run `npm start`.
5. Open your browser to `http://localhost:3000`.

## Architecture Overview for .NET Developers
- **Server (`server/server.js`)**: Equivalent to `Program.cs` + `Controllers` in ASP.NET Core. 
    - Uses `Express` for hosting (middleware pipeline).
    - Uses `Socket.io` for real-time (Hubs).
- **Client (`public/`)**: The "Frontend".
    - `index.html`: The View (Razor page).
    - `js/main.js`: The Entry Point (composition root).
    - `js/game.js`: The Game Controller logic.
    - `js/entities.js`: The Domain Models (Classes).

## Key Comparisons
- **Modules**: `import/export` in JS is like `using` and `public class` in C#.
- **Async/Event Loop**: Node.js is single-threaded. There are no locks/mutexes needed for the global `gameState` variable because code runs sequentially on the event loop!
- **Socket.io**: `socket.emit` sends messages, `socket.on` receives them. Very similar to SignalR.
