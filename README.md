# ChatGPT Remix

This is a Remix Stack focused on creating a ChatGPT conversations interface. It supports multiple users, response streaming, multiple conversations, and a database (persistent) message history. It was based off the [Remix Indie Stack](https://github.com/remix-run/indie-stack), so it is has everything you need to get you started exploring.

Learn more about [Remix Stacks](https://remix.run/stacks).

## Motivation

I created this project because I could not find complete examples on how to use both Remix and the ChatGPT API with streaming and persistent conversation history, without getting overly complex. The idea is for this to be something anyone can run on their machine and not need to spin up Redis, Postgres, Docker, etc. I know a lot of people want to learn about this topic, so I hope this helps some of you get up and running faster.

This will be an evolving project to which I will add new features, better styling, etc. So if you're interested, hop on for the ride!

## Features

- Multiple users
- Multiple conversations per user
- Message history stored in the database
- Context-aware conversations based on all previous messages up to the token limit for the model
- System message (allows instructions for assistant personalization)
- Message streaming ("responds as if typing") via SSE (Server-side-events)

## What's in the stack

- Integration with [OpenAI's Chat completions API](https://platform.openai.com/docs/guides/chat)
- Production-ready [SQLite Database](https://sqlite.org)
- Email/Password Authentication with [cookie-based sessions](https://remix.run/utils/sessions#md-createcookiesessionstorage)
- Database ORM with [Prisma](https://prisma.io)
- Styling with [Tailwind](https://tailwindcss.com/)
- Code formatting with [Prettier](https://prettier.io)
- Static Types with [TypeScript](https://typescriptlang.org)

There's a lot more included (cypress, vitest, eslint, etc.) from the original stack, but I don't mention it above because I haven't configured them for this project yet. See the roadmap.

## Screenshots

Here are a few screenshots of what it looks like right now:

<p float="left">
  <img src="https://perezcarreno.com/wp-content/uploads/2023/03/chatgpt-remix-1.png" width="45%" />
  <img src="https://perezcarreno.com/wp-content/uploads/2023/03/chatgpt-remix-2.png" width="45%" />
  <img src="https://perezcarreno.com/wp-content/uploads/2023/03/chatgpt-remix-3.png" width="45%" />
  <img src="https://perezcarreno.com/wp-content/uploads/2023/03/chatgpt-remix-4.png" width="45%" />
</p>

## Development

- Get a free API key at [OpenAI](https://platform.openai.com/account/api-keys)

- Install dependencies

  ```sh
  npm install
  ```

- Initialize the project

  ```sh
  npx remix init
  ```

  - Copy .env.example to .env and change the SESSION_SECRET to something different

  ```sh
  DATABASE_URL="file:./data.db?connection_limit=1"
  SESSION_SECRET="super-duper-s3cret"
  ```

- Initial setup:

  ```sh
  npm run setup
  ```

- Add your API Key as an environment variable

  ```sh
  export OPENAI_API_KEY=sk-XXXXXXXXXXXXXXXXXXXX
  ```

- Start dev server:

  ```sh
  npm run dev
  ```

This starts your app in development mode, rebuilding assets on file changes.

The database seed script creates a new user with some data you can use to get started:

- Email: `test@account.com`
- Password: `1q2w3e4r`

### Relevant code:

This is a basic implementation of a ChatGPT conversations interface, but it's a good example of how you can build a full stack app with Prisma and Remix. The main functionality is creating users, logging in and out, and creating and deleting conversations that interact with the ChatGPT API. You can change the system message to have it follow your desired personality.

- creating users, and logging in and out [./app/models/user.server.ts](./app/models/user.server.ts)
- user sessions, and verifying them [./app/session.server.ts](./app/session.server.ts)
- creating, and deleting conversations [./app/models/conversation.server.ts](./app/models/conversation.server.ts)
- creating, and deleting messages [./app/models/message.server.ts](./app/models/message.server.ts)
- show messages inside a conversation and create new messages [./app/conversations/conversationId.tsx](./app/conversations/conversationId.tsx)
- interact with the ChatGPT API [./app/routes/completion.tsx](./app/routes/completion.tsx)

## Deployment

This Remix Stack comes with two GitHub Actions that handle automatically deploying your app to production and staging environments.

Prior to your first deployment, you'll need to do a few things:

- [Install Fly](https://fly.io/docs/getting-started/installing-flyctl/)

- Sign up and log in to Fly

  ```sh
  fly auth signup
  ```

  > **Note:** If you have more than one Fly account, ensure that you are signed into the same account in the Fly CLI as you are in the browser. In your terminal, run `fly auth whoami` and ensure the email matches the Fly account signed into the browser.

- Create two apps on Fly, one for staging and one for production:

  ```sh
  fly apps create chatgpt-remix
  fly apps create chatgpt-remix-staging
  ```

  > **Note:** Make sure this name matches the `app` set in your `fly.toml` file. Otherwise, you will not be able to deploy.

  - Initialize Git.

  ```sh
  git init
  ```

- Create a new [GitHub Repository](https://repo.new), and then add it as the remote for your project. **Do not push your app yet!**

  ```sh
  git remote add origin <ORIGIN_URL>
  ```

- Add a `FLY_API_TOKEN` to your GitHub repo. To do this, go to your user settings on Fly and create a new [token](https://web.fly.io/user/personal_access_tokens/new), then add it to [your repo secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets) with the name `FLY_API_TOKEN`.

- Add a `SESSION_SECRET` to your fly app secrets, to do this you can run the following commands:

  ```sh
  fly secrets set SESSION_SECRET=$(openssl rand -hex 32) --app chatgpt-remix
  fly secrets set SESSION_SECRET=$(openssl rand -hex 32) --app chatgpt-remix-staging
  ```

  If you don't have openssl installed, you can also use [1password](https://1password.com/password-generator/) to generate a random secret, just replace `$(openssl rand -hex 32)` with the generated secret.

- Create a persistent volume for the sqlite database for both your staging and production environments. Run the following:

  ```sh
  fly volumes create data --size 1 --app chatgpt-remix
  fly volumes create data --size 1 --app chatgpt-remix-staging
  ```

Now that everything is set up you can commit and push your changes to your repo. Every commit to your `main` branch will trigger a deployment to your production environment, and every commit to your `dev` branch will trigger a deployment to your staging environment.

### Connecting to your database

The sqlite database lives at `/data/sqlite.db` in your deployed application. You can connect to the live database by running `fly ssh console -C database-cli`.

### Getting Help with Deployment

If you run into any issues deploying to Fly, make sure you've followed all of the steps above and if you have, then post as many details about your deployment (including your app name) to [the Fly support community](https://community.fly.io). They're normally pretty responsive over there and hopefully can help resolve any of your deployment issues and questions.

## GitHub Actions

We use GitHub Actions for continuous integration and deployment. Anything that gets into the `main` branch will be deployed to production after running tests/build/etc. Anything in the `dev` branch will be deployed to staging.

## Roadmap

- [x] Integrate streaming responses from the ChatGPT API
- [x] Keep persistent message history for each user and conversation in the database
- [x] Support for Fly.io
- [ ] Styling enhancements
- [ ] Mobile drawer sidebar
- [ ] System message UI
- [ ] Support for embeddings
- [ ] Support for other authentication methods
- [ ] Include unit tests

### Type Checking

This project uses TypeScript. It's recommended to get TypeScript set up for your editor to get a really great in-editor experience with type checking and auto-complete. To run type checking across the whole project, run `npm run typecheck`.

### Formatting

We use [Prettier](https://prettier.io/) for auto-formatting in this project. It's recommended to install an editor plugin (like the [VSCode Prettier plugin](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)) to get auto-formatting on save. There's also a `npm run format` script you can run to format all files in the project.

## License

Distributed under the MIT License. See `LICENSE.txt` for more information.

## Contact

Armando J. Perez-Carreno - [@perezcarreno](https://twitter.com/perezcarreno)

Project Link: [https://github.com/perezcarreno/chatgpt-remix](https://github.com/perezcarreno/chatgpt-remix)

## Acknowledgments

A huge shoutout to these wonderful people and teams, without which none of this could be possible.

- [Remix](https://github.com/remix-run)
- [OpenAI](https://github.com/openai)
- [Joel (waylaidwanderer)](https://github.com/waylaidwanderer/node-chatgpt-api)
- [Travis Fischer](https://github.com/transitive-bullshit)
- [Sergio Xalambri](https://github.com/sergiodxa)
