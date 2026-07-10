import type { Command } from '../types/command'
import { ping } from './ping'
import { embed } from './embed'

/** Registre central des slash-commands. Ajoute chaque nouvelle commande ici. */
export const commands: Command[] = [ping, embed]

/** Accès rapide par nom, utilisé par le routeur d'interactions. */
export const commandMap = new Map<string, Command>(commands.map(c => [c.data.name, c]))
