interface Props {
  processed: number
  total: number
}

export function ProgressBar({ processed, total }: Props) {
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">
          Today's Progress
        </h3>
        <span className="text-sm text-gray-600">
          {processed} / {total} documents processed
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div
          className="bg-gradient-to-r from-green-500 to-green-600 h-4 rounded-full transition-all duration-500 ease-out flex items-center justify-center"
          style={{ width: `${percentage}%` }}
        >
          {percentage > 10 && (
            <span className="text-xs font-bold text-white">
              {percentage}%
            </span>
          )}
        </div>
      </div>
      
      {total > 0 && processed === total && (
        <p className="text-sm text-green-600 font-medium mt-2">
          🎉 All documents processed for today!
        </p>
      )}
    </div>
  )
}
