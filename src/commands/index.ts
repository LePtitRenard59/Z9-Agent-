import type { Command } from '../types/command'
import { ping } from './ping'
import { embed } from './embed'
import { reactionRole } from './reactionrole'
import { tickets } from './tickets'
import { welcomeCommand, goodbyeCommand } from './greetings'
import { faq } from './faq'

/** Registre central des slash-commands. Ajoute chaque nouvelle commande ici. */
export const commands: Command[] = [ping, embed, reactionRole, tickets, welcomeCommand, goodbyeCommand, faq]

/** Accès rapide par nom, utilisé par le routeur d'interactions. */
export const commandMap = new Map<string, Command>(commands.map(c => [c.data.name, c]))
