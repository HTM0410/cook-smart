import React from 'react'
import { Link } from 'react-router-dom'
import Button from '../components/atoms/Button'

const NotFoundPage: React.FC = () => {
  return (
    <div className="container py-16">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-6xl font-bold text-primary-500 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-foreground mb-4">
          Trang không tìm thấy
        </h2>
        <p className="text-muted-foreground mb-8">
          Xin lỗi, trang bạn đang tìm kiếm không tồn tại.
        </p>
        <Link to="/">
          <Button>
            Về trang chủ
          </Button>
        </Link>
      </div>
    </div>
  )
}

export default NotFoundPage
