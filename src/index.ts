import { Client, Events, GatewayIntentBits, Partials } from 'discord.js'
import { config } from './config'
import { onInteraction } from './events/interactionCreate'
import { onGuildMemberAdd, onGuildMemberRemove } from './events/greetings'
import { onReactionAdd, onReactionRemove } from './events/reactions'

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
})

client.once(Events.ClientReady, readyClient => {
  console.log(`✅ Connecté en tant que ${readyClient.user.tag}`)
})

client.on(Events.InteractionCreate, onInteraction)
client.on(Events.GuildMemberAdd, onGuildMemberAdd)
client.on(Events.GuildMemberRemove, onGuildMemberRemove)
client.on(Events.MessageReactionAdd, onReactionAdd)
client.on(Events.MessageReactionRemove, onReactionRemove)

client.login(config.token)
