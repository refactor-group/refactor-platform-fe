import * as React from "react"

export const ImagePlusIcon = React.memo(
  ({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
    return (
      <svg
        width="24"
        height="24"
        className={className}
        viewBox="0 0 24 24"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M5 3H15C16.1046 3 17 3.89543 17 5V15C17 16.1046 16.1046 17 15 17H5C3.89543 17 3 16.1046 3 15V5C3 3.89543 3.89543 3 5 3ZM5 5V15H15V5H5Z"
          fill="currentColor"
        />
        <path
          d="M9.5 8.5C9.5 9.32843 8.82843 10 8 10C7.17157 10 6.5 9.32843 6.5 8.5C6.5 7.67157 7.17157 7 8 7C8.82843 7 9.5 7.67157 9.5 8.5Z"
          fill="currentColor"
        />
        <path
          d="M6 14L9.25 10L11.5 12.75L12.75 11.25L15 14H6Z"
          fill="currentColor"
        />
        <path
          d="M17.5 15H19.5V17.5H22V19.5H19.5V22H17.5V19.5H15V17.5H17.5V15Z"
          fill="currentColor"
        />
      </svg>
    )
  }
)

ImagePlusIcon.displayName = "ImagePlusIcon"
