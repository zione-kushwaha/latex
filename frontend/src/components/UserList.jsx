export default function UserList({ users, currentUserId }) {
  return (
    <div className="user-list">
      <span className="user-list-label">
        {users.length}/4 online
      </span>
      <div className="user-avatars">
        {users.map((u) => (
          <div
            key={u.id}
            className="user-avatar"
            title={u.id === currentUserId ? `${u.name} (you)` : u.name}
            style={{ background: u.color, outline: u.id === currentUserId ? `2px solid white` : 'none' }}
          >
            {u.name.charAt(0)}
          </div>
        ))}
      </div>
    </div>
  )
}
