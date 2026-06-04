import { os } from '@orpc/server'
import type { TaktContext } from './context'

/** Base oRPC builder bound to the takt context. Procedures + middleware build off this. */
export const pub = os.$context<TaktContext>()
