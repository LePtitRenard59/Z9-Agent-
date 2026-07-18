import type { ContextMenuCommandBuilder } from 'discord.js'
import { reportMessageCommand, reportUserCommand } from '../features/report/report'

/** Commandes contextuelles (clic droit sur un message / un membre). */
export const contextCommands: ContextMenuCommandBuilder[] = [reportMessageCommand, reportUserCommand]
