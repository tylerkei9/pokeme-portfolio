import { useState } from 'react'
import instagramData from '../data/instagramPosts.json'
import { InstagramPostView } from './InstagramPostView'

export function InstagramProfile({ onBack }: { onBack: () => void }) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const { profile, posts } = instagramData

  const selectedPost = posts.find((p) => p.id === selectedPostId)

  if (selectedPost) {
    return <InstagramPostView post={selectedPost} onBack={() => setSelectedPostId(null)} />
  }

  return (
    <div className="flex-1 bg-black overflow-y-auto">
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <button onClick={onBack} className="text-white text-lg">←</button>
        <span className="font-pixel text-xs text-white">{profile.username}</span>
        <span className="text-white text-lg">≡</span>
      </div>

      {/* Profile info */}
      <div className="p-4">
        <div className="flex items-center gap-4 mb-3">
          {/* Profile pic */}
          <div className="w-16 h-16 rounded-full bg-gray-700 overflow-hidden border-2 border-gray-600 flex-shrink-0">
            <div className="w-full h-full bg-gray-600" />
          </div>

          {/* Stats */}
          <div className="flex gap-4 text-center flex-1">
            <div>
              <p className="font-pixel text-xs text-white">{profile.posts}</p>
              <p className="font-pixel text-[8px] text-gray-400">posts</p>
            </div>
            <div>
              <p className="font-pixel text-xs text-white">{profile.followers}</p>
              <p className="font-pixel text-[8px] text-gray-400">followers</p>
            </div>
            <div>
              <p className="font-pixel text-xs text-white">{profile.following}</p>
              <p className="font-pixel text-[8px] text-gray-400">following</p>
            </div>
          </div>
        </div>

        <p className="font-pixel text-[10px] text-white">{profile.displayName}</p>
        <p className="font-pixel text-[9px] text-gray-400">{profile.bio}</p>
      </div>

      {/* Buttons */}
      <div className="flex gap-2 px-4 mb-3">
        <div className="flex-1 bg-gray-800 rounded py-1 text-center">
          <span className="font-pixel text-[9px] text-white">Edit profile</span>
        </div>
        <div className="flex-1 bg-gray-800 rounded py-1 text-center">
          <span className="font-pixel text-[9px] text-white">Share profile</span>
        </div>
      </div>

      {/* Grid tab bar */}
      <div className="flex border-b border-gray-800">
        <div className="flex-1 py-2 text-center border-b-2 border-white">
          <span className="text-white text-sm">▦</span>
        </div>
        <div className="flex-1 py-2 text-center">
          <span className="text-gray-600 text-sm">▶</span>
        </div>
      </div>

      {/* Post grid */}
      <div className="grid grid-cols-3 gap-[2px]">
        {posts
          .filter((p) => !(p as any).isProfileOverview)
          .map((post) => (
            <button
              key={post.id}
              onClick={() => setSelectedPostId(post.id)}
              className="aspect-square bg-gray-800 overflow-hidden"
            >
              <img
                src={post.image}
                alt={post.caption || 'Post'}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
      </div>
    </div>
  )
}
