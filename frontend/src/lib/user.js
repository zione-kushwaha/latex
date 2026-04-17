import { v4 as uuidv4 } from 'uuid'

const ADJECTIVES = ['Swift', 'Bright', 'Calm', 'Bold', 'Keen', 'Wise', 'Cool', 'Zany']
const NOUNS = ['Panda', 'Falcon', 'Otter', 'Tiger', 'Lynx', 'Raven', 'Wolf', 'Fox']
const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6', '#f97316']

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function getOrCreateUser() {
  const stored = sessionStorage.getItem('tlc_user')
  if (stored) return JSON.parse(stored)

  const user = {
    id: uuidv4(),
    name: `${randomItem(ADJECTIVES)} ${randomItem(NOUNS)}`,
    color: randomItem(COLORS),
    cursor: 0,
  }
  sessionStorage.setItem('tlc_user', JSON.stringify(user))
  return user
}
