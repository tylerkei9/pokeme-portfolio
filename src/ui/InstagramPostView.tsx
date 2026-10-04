interface Post {
  id: string
  image: string
  caption: string
  music?: string
  location?: string
  likes: number
  comments: number
  date: string
  label?: string
}

export function InstagramPostView({ post, onBack }: { post: Post; onBack: () => void }) {
  return (
    <div className="flex-1 bg-black overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-800">
        <button onClick={onBack} className="text-white text-lg">←</button>
        <div className="flex items-center gap-2 flex-1">
          <div className="w-8 h-8 rounded-full bg-gray-700" />
          <div>
            <p className="font-pixel text-[10px] text-white">tylerkei9</p>
            {post.music && (
              <p className="font-pixel text-[8px] text-gray-400">♪ {post.music}</p>
            )}
            {post.location && !post.music && (
              <p className="font-pixel text-[8px] text-gray-400">{post.location}</p>
            )}
            {post.label && (
              <p className="font-pixel text-[8px] text-gray-400">{post.label}</p>
            )}
          </div>
        </div>
        <span className="text-white">⋯</span>
      </div>

      {/* Image */}
      <div className="w-full">
        <img src={post.image} alt={post.caption || 'Post'} className="w-full" />
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex gap-4">
          <span className="text-white text-lg">♡</span>
          <span className="text-white text-lg">💬</span>
          <span className="text-white text-lg">↗</span>
        </div>
        <span className="text-white text-lg">⊡</span>
      </div>

      {/* Likes */}
      {post.likes > 0 && (
        <p className="font-pixel text-[10px] text-white px-3">
          {post.likes.toLocaleString()} likes
        </p>
      )}
      {post.likes === 0 && (
        <p className="font-pixel text-[10px] text-gray-400 px-3">
          Liked by others
        </p>
      )}

      {/* Caption */}
      {post.caption && (
        <p className="font-pixel text-[10px] text-white px-3 mt-1">
          <span className="font-bold">tylerkei9</span> {post.caption}
        </p>
      )}

      {/* Comments */}
      {post.comments > 0 && (
        <p className="font-pixel text-[9px] text-gray-500 px-3 mt-1">
          View all {post.comments} comments
        </p>
      )}

      {/* Date */}
      {post.date && (
        <p className="font-pixel text-[8px] text-gray-600 px-3 mt-1 mb-4">
          {post.date}
        </p>
      )}
    </div>
  )
}
